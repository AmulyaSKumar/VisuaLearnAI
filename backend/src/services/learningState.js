/**
 * Learning State Service
 * Persists and retrieves learning state from Supabase
 * Provides cross-session continuity for cognitive states
 * @module services/learningState
 */

import { supabase } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { cache } from './cache.js';

/**
 * Cognitive states enum
 */
export const CognitiveState = {
  STRUGGLING: 'struggling',
  CONFUSED: 'confused',
  FLOW: 'flow',
  BORED: 'bored',
  MASTERING: 'mastering',
};

/**
 * Default TTL for cached learning state (5 minutes)
 */
const CACHE_TTL = 300;

/**
 * Get user's current cognitive state for a topic
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} Topic progress with cognitive state
 */
export async function getCognitiveState(userId, topic) {
  if (!userId || !topic) {
    return { cognitiveState: CognitiveState.FLOW, masteryLevel: 0 };
  }

  const cacheKey = `learning:state:${userId}:${topic}`;

  try {
    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ userId, topic, source: 'cache' }, 'Retrieved cognitive state from cache');
      return cached;
    }

    // Query database
    const { data, error } = await supabase
      .from('topic_progress')
      .select('cognitive_state, mastery_level, attempt_count, success_count, avg_effectiveness, avg_engagement')
      .eq('user_id', userId)
      .eq('topic', topic.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, userId, topic }, 'Failed to get cognitive state');
      throw error;
    }

    const result = data ? {
      cognitiveState: data.cognitive_state || CognitiveState.FLOW,
      masteryLevel: parseFloat(data.mastery_level) || 0,
      attemptCount: data.attempt_count || 0,
      successCount: data.success_count || 0,
      avgEffectiveness: parseFloat(data.avg_effectiveness) || 0.5,
      avgEngagement: parseFloat(data.avg_engagement) || 0.5,
    } : {
      cognitiveState: CognitiveState.FLOW,
      masteryLevel: 0,
      attemptCount: 0,
      successCount: 0,
      avgEffectiveness: 0.5,
      avgEngagement: 0.5,
    };

    // Cache the result
    await cache.set(cacheKey, result, CACHE_TTL);

    logger.debug({ userId, topic, state: result.cognitiveState }, 'Retrieved cognitive state');
    return result;
  } catch (err) {
    logger.error({ error: err, userId, topic }, 'Error getting cognitive state');
    return { cognitiveState: CognitiveState.FLOW, masteryLevel: 0 };
  }
}

/**
 * Update user's cognitive state for a topic
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @param {string} newState - New cognitive state
 * @param {Object} metrics - Optional metrics (effectiveness, engagement)
 * @returns {Promise<Object>} Updated topic progress
 */
export async function updateCognitiveState(userId, topic, newState, metrics = {}) {
  if (!userId || !topic) {
    logger.warn({ userId, topic }, 'Missing userId or topic for state update');
    return null;
  }

  const normalizedTopic = topic.toLowerCase();
  const cacheKey = `learning:state:${userId}:${normalizedTopic}`;

  try {
    // Get current progress
    const { data: existing } = await supabase
      .from('topic_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', normalizedTopic)
      .single();

    const now = new Date().toISOString();
    const isSuccess = newState === CognitiveState.MASTERING || newState === CognitiveState.FLOW;

    // Calculate new averages
    const attemptCount = (existing?.attempt_count || 0) + 1;
    const successCount = (existing?.success_count || 0) + (isSuccess ? 1 : 0);
    const avgEffectiveness = existing
      ? (existing.avg_effectiveness * existing.attempt_count + (metrics.effectiveness || 0.5)) / attemptCount
      : metrics.effectiveness || 0.5;
    const avgEngagement = existing
      ? (existing.avg_engagement * existing.attempt_count + (metrics.engagement || 0.5)) / attemptCount
      : metrics.engagement || 0.5;

    // Build state history entry
    const stateEntry = {
      state: newState,
      timestamp: now,
      effectiveness: metrics.effectiveness,
      engagement: metrics.engagement,
    };

    const stateHistory = existing?.state_history || [];
    stateHistory.push(stateEntry);
    // Keep only last 50 state entries
    if (stateHistory.length > 50) {
      stateHistory.shift();
    }

    // Calculate mastery level
    const masteryLevel = calculateMasteryLevel(successCount, attemptCount, avgEffectiveness);

    const progressData = {
      user_id: userId,
      topic: normalizedTopic,
      cognitive_state: newState,
      mastery_level: masteryLevel,
      attempt_count: attemptCount,
      success_count: successCount,
      last_attempt_at: now,
      avg_effectiveness: Math.round(avgEffectiveness * 100) / 100,
      avg_engagement: Math.round(avgEngagement * 100) / 100,
      time_spent_seconds: (existing?.time_spent_seconds || 0) + (metrics.timeSpent || 0),
      state_history: stateHistory,
      metadata: { ...existing?.metadata, ...metrics.metadata },
    };

    // Upsert progress
    const { data, error } = await supabase
      .from('topic_progress')
      .upsert(progressData, { onConflict: 'user_id,topic' })
      .select()
      .single();

    if (error) {
      logger.error({ error, userId, topic }, 'Failed to update cognitive state');
      throw error;
    }

    // Invalidate cache
    await cache.del(cacheKey);

    // Record snapshot for analytics
    await recordStateSnapshot(userId, null, normalizedTopic, newState, metrics);

    logger.info({ userId, topic: normalizedTopic, oldState: existing?.cognitive_state, newState, masteryLevel }, 'Updated cognitive state');

    return {
      cognitiveState: data.cognitive_state,
      masteryLevel: parseFloat(data.mastery_level),
      attemptCount: data.attempt_count,
      successCount: data.success_count,
    };
  } catch (err) {
    logger.error({ error: err, userId, topic }, 'Error updating cognitive state');
    return null;
  }
}

/**
 * Record a learning attempt for a topic
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @param {boolean} success - Whether the attempt was successful
 * @param {Object} metrics - Attempt metrics
 * @returns {Promise<Object>} Updated progress
 */
export async function recordAttempt(userId, topic, success, metrics = {}) {
  const newState = success
    ? (metrics.effectiveness > 0.8 ? CognitiveState.MASTERING : CognitiveState.FLOW)
    : (metrics.effectiveness < 0.3 ? CognitiveState.STRUGGLING : CognitiveState.CONFUSED);

  return updateCognitiveState(userId, topic, newState, {
    effectiveness: metrics.effectiveness || (success ? 0.7 : 0.3),
    engagement: metrics.engagement || 0.5,
    timeSpent: metrics.timeSpent || 0,
    metadata: metrics.metadata,
  });
}

/**
 * Start a new learning session
 * @param {string} userId - User ID
 * @param {string} initialState - Initial cognitive state
 * @returns {Promise<Object>} Created session
 */
export async function startSession(userId, initialState = CognitiveState.FLOW) {
  if (!userId) {
    logger.warn('Cannot start session without userId');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('learning_sessions')
      .insert({
        user_id: userId,
        initial_state: initialState,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, userId }, 'Failed to start learning session');
      throw error;
    }

    logger.info({ userId, sessionId: data.id }, 'Started learning session');
    return data;
  } catch (err) {
    logger.error({ error: err, userId }, 'Error starting session');
    return null;
  }
}

/**
 * End a learning session
 * @param {string} sessionId - Session ID
 * @param {Object} summary - Session summary
 * @returns {Promise<Object>} Updated session
 */
export async function endSession(sessionId, summary = {}) {
  if (!sessionId) return null;

  try {
    const { data: session } = await supabase
      .from('learning_sessions')
      .select('started_at')
      .eq('id', sessionId)
      .single();

    const endedAt = new Date();
    const duration = session
      ? Math.round((endedAt - new Date(session.started_at)) / 1000)
      : 0;

    const { data, error } = await supabase
      .from('learning_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
        final_state: summary.finalState || CognitiveState.FLOW,
        topics_covered: summary.topics || [],
        interaction_count: summary.interactionCount || 0,
        effectiveness_score: summary.effectiveness,
        metadata: summary.metadata || {},
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      logger.error({ error, sessionId }, 'Failed to end session');
      throw error;
    }

    logger.info({ sessionId, duration, finalState: summary.finalState }, 'Ended learning session');
    return data;
  } catch (err) {
    logger.error({ error: err, sessionId }, 'Error ending session');
    return null;
  }
}

/**
 * Record a state snapshot for analytics
 * @param {string} userId - User ID
 * @param {string} sessionId - Optional session ID
 * @param {string} topic - Topic name
 * @param {string} state - Cognitive state
 * @param {Object} metrics - Metrics
 */
async function recordStateSnapshot(userId, sessionId, topic, state, metrics = {}) {
  try {
    await supabase.from('learning_state_snapshots').insert({
      user_id: userId,
      session_id: sessionId,
      topic,
      cognitive_state: state,
      effectiveness: metrics.effectiveness,
      engagement: metrics.engagement,
      source: metrics.source || 'chat',
      context: metrics.context || {},
    });
  } catch (err) {
    // Non-critical, just log
    logger.warn({ error: err, userId, topic }, 'Failed to record state snapshot');
  }
}

/**
 * Get user's overall learning progress
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Learning progress summary
 */
export async function getUserProgress(userId) {
  if (!userId) return null;

  const cacheKey = `learning:progress:${userId}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Get topic progress
    const { data: topics, error: topicsError } = await supabase
      .from('topic_progress')
      .select('topic, cognitive_state, mastery_level, attempt_count, time_spent_seconds, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (topicsError) throw topicsError;

    // Get recent sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('learning_sessions')
      .select('id, started_at, ended_at, duration_seconds, final_state, topics_covered, effectiveness_score')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (sessionsError) throw sessionsError;

    // Calculate summary
    const totalTopics = topics?.length || 0;
    const masteredTopics = topics?.filter(t => parseFloat(t.mastery_level) >= 0.8).length || 0;
    const strugglingTopics = topics?.filter(t => t.cognitive_state === CognitiveState.STRUGGLING).length || 0;
    const avgMastery = totalTopics > 0
      ? topics.reduce((sum, t) => sum + parseFloat(t.mastery_level || 0), 0) / totalTopics
      : 0;
    const totalTime = topics?.reduce((sum, t) => sum + (t.time_spent_seconds || 0), 0) || 0;

    const progress = {
      userId,
      totalTopics,
      masteredTopics,
      strugglingTopics,
      avgMastery: Math.round(avgMastery * 100) / 100,
      totalTimeSeconds: totalTime,
      topics: topics || [],
      recentSessions: sessions || [],
      topicsByState: {
        mastering: topics?.filter(t => t.cognitive_state === CognitiveState.MASTERING).map(t => t.topic) || [],
        flow: topics?.filter(t => t.cognitive_state === CognitiveState.FLOW).map(t => t.topic) || [],
        confused: topics?.filter(t => t.cognitive_state === CognitiveState.CONFUSED).map(t => t.topic) || [],
        struggling: topics?.filter(t => t.cognitive_state === CognitiveState.STRUGGLING).map(t => t.topic) || [],
        bored: topics?.filter(t => t.cognitive_state === CognitiveState.BORED).map(t => t.topic) || [],
      },
    };

    await cache.set(cacheKey, progress, CACHE_TTL);

    logger.debug({ userId, totalTopics, avgMastery }, 'Retrieved user progress');
    return progress;
  } catch (err) {
    logger.error({ error: err, userId }, 'Error getting user progress');
    return null;
  }
}

/**
 * Get weak topics that need attention
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} List of weak topic names
 */
export async function getWeakTopics(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('topic_progress')
      .select('topic')
      .eq('user_id', userId)
      .in('cognitive_state', [CognitiveState.STRUGGLING, CognitiveState.CONFUSED])
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    return data?.map(d => d.topic) || [];
  } catch (err) {
    logger.error({ error: err, userId }, 'Error getting weak topics');
    return [];
  }
}

/**
 * Get strong topics the user has mastered
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} List of strong topic names
 */
export async function getStrongTopics(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('topic_progress')
      .select('topic')
      .eq('user_id', userId)
      .gte('mastery_level', 0.7)
      .order('mastery_level', { ascending: false })
      .limit(5);

    if (error) throw error;

    return data?.map(d => d.topic) || [];
  } catch (err) {
    logger.error({ error: err, userId }, 'Error getting strong topics');
    return [];
  }
}

/**
 * Calculate mastery level from metrics
 */
function calculateMasteryLevel(successCount, attemptCount, avgEffectiveness) {
  if (attemptCount === 0) return 0;

  const successRate = successCount / attemptCount;
  // Weighted: 60% success rate + 40% effectiveness
  const mastery = (successRate * 0.6) + (avgEffectiveness * 0.4);

  return Math.min(1, Math.max(0, Math.round(mastery * 100) / 100));
}

export default {
  CognitiveState,
  getCognitiveState,
  updateCognitiveState,
  recordAttempt,
  startSession,
  endSession,
  getUserProgress,
  getWeakTopics,
  getStrongTopics,
};
