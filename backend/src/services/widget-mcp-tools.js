
/**
 * Widget MCP Tools
 * Exposes tools for widget analytics, profile updates, and caching
 * @module services/widget-mcp-tools
 */

import { supabase } from '../database/client.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// =============================================================================
// WIDGET ANALYTICS
// =============================================================================

/**
 * Run widget analytics - track user interactions with widgets
 * @param {Object} data - Analytics data from widget
 * @returns {Promise<Object>} Analytics result
 */
export async function run_widget_analytics(data) {
  const {
    userId,
    widgetId,
    widgetType,
    topic,
    interactions = [],
    viewDuration = 0,
    completionRate = 0,
    quizScore = null,
    hintsUsed = 0,
    errorsCount = 0,
    predictionAccuracy = null,
  } = data;

  logger.info('MCP: Running widget analytics', { userId, widgetId, widgetType });

  try {
    // Store in widget_analytics table
    const { data: analyticsRecord, error } = await supabase
      .from('widget_analytics')
      .insert({
        user_id: userId,
        widget_id: widgetId,
        widget_type: widgetType,
        topic,
        view_duration_ms: viewDuration,
        interaction_count: interactions.length,
        completion_rate: completionRate,
        quiz_score: quizScore,
        hints_used: hintsUsed,
        errors_count: errorsCount,
        prediction_accuracy: predictionAccuracy,
        interactions_log: interactions,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('MCP: Widget analytics insert failed', { error: error.message });
      return { success: false, error: error.message };
    }

    // Calculate engagement score for this widget session
    const engagementScore = calculateWidgetEngagement(data);

    // Determine if user struggled (for profile update)
    const struggled = errorsCount > 2 || hintsUsed > 2 || completionRate < 0.5;
    const mastered = quizScore >= 0.8 && errorsCount === 0 && completionRate >= 0.9;

    logger.info('MCP: Widget analytics complete', {
      analyticsId: analyticsRecord?.id,
      engagementScore,
      struggled,
      mastered,
    });

    return {
      success: true,
      analyticsId: analyticsRecord?.id,
      engagementScore,
      insights: {
        struggled,
        mastered,
        needsMorePractice: struggled && !mastered,
        recommendedNextAction: struggled
          ? 'show_simpler_widget'
          : mastered
          ? 'advance_difficulty'
          : 'continue_current_path',
      },
    };
  } catch (err) {
    logger.error('MCP: Widget analytics error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Calculate engagement score from widget interaction data
 */
function calculateWidgetEngagement(data) {
  const { viewDuration, interactions, completionRate, hintsUsed, errorsCount } = data;

  // Weights for different factors
  const weights = {
    duration: 0.2,      // Time spent (optimal: 60-300 seconds)
    interactions: 0.25, // Number of interactions
    completion: 0.3,    // How much of widget completed
    hints: 0.1,         // Hint usage (lower is better)
    errors: 0.15,       // Error rate (lower is better)
  };

  // Duration score (0-100): optimal is 60-300 seconds
  const durationSec = viewDuration / 1000;
  let durationScore = 0;
  if (durationSec >= 60 && durationSec <= 300) {
    durationScore = 100;
  } else if (durationSec < 60) {
    durationScore = (durationSec / 60) * 100;
  } else {
    durationScore = Math.max(50, 100 - ((durationSec - 300) / 60) * 10);
  }

  // Interaction score (0-100): more is better, cap at 10
  const interactionScore = Math.min(100, ((interactions?.length || 0) / 10) * 100);

  // Completion score (0-100)
  const completionScore = (completionRate || 0) * 100;

  // Hints score (0-100): fewer hints is better
  const hintsScore = Math.max(0, 100 - (hintsUsed || 0) * 25);

  // Errors score (0-100): fewer errors is better
  const errorsScore = Math.max(0, 100 - (errorsCount || 0) * 20);

  // Weighted average
  const engagementScore =
    durationScore * weights.duration +
    interactionScore * weights.interactions +
    completionScore * weights.completion +
    hintsScore * weights.hints +
    errorsScore * weights.errors;

  return Math.round(engagementScore);
}

// =============================================================================
// USER PROFILE UPDATES
// =============================================================================

/**
 * Update user profile based on widget performance
 * @param {Object} data - Profile update data
 * @returns {Promise<Object>} Update result
 */
export async function update_user_profile(data) {
  const {
    userId,
    topic,
    performance, // 'struggled' | 'normal' | 'mastered'
    quizScore,
    confidenceChange, // -0.1 to +0.1
    learningStyleSignals, // { visual: +0.05, kinesthetic: -0.02, ... }
  } = data;

  logger.info('MCP: Updating user profile', { userId, topic, performance });

  try {
    // Fetch current profile
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      logger.error('MCP: Profile fetch failed', { error: fetchError?.message });
      return { success: false, error: 'Profile not found' };
    }

    // Update weak/strong topics based on performance
    let weakTopics = profile.weak_topics || [];
    let strongTopics = profile.strong_topics || [];

    if (topic) {
      const lowerTopic = topic.toLowerCase();

      if (performance === 'struggled') {
        // Add to weak if not already there
        if (!weakTopics.includes(lowerTopic)) {
          weakTopics.push(lowerTopic);
        }
        // Remove from strong if there
        strongTopics = strongTopics.filter(t => t !== lowerTopic);
      } else if (performance === 'mastered') {
        // Add to strong if not already there
        if (!strongTopics.includes(lowerTopic)) {
          strongTopics.push(lowerTopic);
        }
        // Remove from weak if there
        weakTopics = weakTopics.filter(t => t !== lowerTopic);
      }
    }

    // Update confidence score
    let newConfidence = profile.confidence_score ?? 0.5;
    if (confidenceChange) {
      newConfidence = Math.max(0, Math.min(1, newConfidence + confidenceChange));
    }

    // Update learning style scores if signals provided
    let newStyles = profile.detected_styles || {
      visual: 0.25,
      auditory: 0.25,
      reading: 0.25,
      kinesthetic: 0.25,
    };

    if (learningStyleSignals) {
      Object.entries(learningStyleSignals).forEach(([style, change]) => {
        if (newStyles[style] !== undefined) {
          newStyles[style] = Math.max(0.1, Math.min(0.9, newStyles[style] + change));
        }
      });

      // Normalize to sum = 1
      const total = Object.values(newStyles).reduce((a, b) => a + b, 0);
      Object.keys(newStyles).forEach(style => {
        newStyles[style] = newStyles[style] / total;
      });
    }

    // Save updates
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        weak_topics: weakTopics.slice(-20), // Keep last 20
        strong_topics: strongTopics.slice(-20),
        confidence_score: newConfidence,
        detected_styles: newStyles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('MCP: Profile update failed', { error: updateError.message });
      return { success: false, error: updateError.message };
    }

    logger.info('MCP: Profile updated successfully', {
      userId,
      newConfidence,
      weakTopicsCount: weakTopics.length,
      strongTopicsCount: strongTopics.length,
    });

    return {
      success: true,
      updates: {
        confidence_score: newConfidence,
        weak_topics: weakTopics,
        strong_topics: strongTopics,
        detected_styles: newStyles,
      },
    };
  } catch (err) {
    logger.error('MCP: Profile update error', { error: err.message });
    return { success: false, error: err.message };
  }
}

// =============================================================================
// WIDGET CACHING
// =============================================================================

/**
 * Generate cache hash for widget parameters
 */
function generateWidgetHash(params) {
  const normalized = JSON.stringify({
    topic: params.topic?.toLowerCase(),
    widgetType: params.widgetType,
    difficulty: params.difficulty,
    learningStyle: params.learningStyle,
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Store widget in cache
 * @param {string} hash - Widget content hash
 * @param {Object} widget - Widget definition
 * @returns {Promise<Object>} Cache result
 */
export async function store_widget_cache(hash, widget) {
  logger.info('MCP: Storing widget in cache', { hash, widgetType: widget.widget_type });

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day TTL

    const { data, error } = await supabase
      .from('widget_cache')
      .upsert({
        content_hash: hash,
        widget_type: widget.widget_type,
        widget_code: widget.html_code,
        metadata: {
          reasoning: widget.reasoning,
          personalization: widget.personalization_applied,
          interaction_model: widget.interaction_model,
          created_at: new Date().toISOString(),
        },
        hit_count: 0,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'content_hash',
      })
      .select()
      .single();

    if (error) {
      logger.error('MCP: Cache store failed', { error: error.message });
      return { success: false, error: error.message };
    }

    logger.info('MCP: Widget cached successfully', { hash });
    return { success: true, cacheId: data?.id, hash };
  } catch (err) {
    logger.error('MCP: Cache store error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve widget from cache
 * @param {string} hash - Widget content hash
 * @returns {Promise<Object>} Cached widget or null
 */
export async function get_cached_widget(hash) {
  logger.info('MCP: Checking widget cache', { hash });

  try {
    const { data, error } = await supabase
      .from('widget_cache')
      .select('*')
      .eq('content_hash', hash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      logger.debug('MCP: Cache miss', { hash });
      return { success: true, cached: false, widget: null };
    }

    // Increment hit count
    await supabase
      .from('widget_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('content_hash', hash);

    logger.info('MCP: Cache hit', { hash, hitCount: data.hit_count + 1 });

    return {
      success: true,
      cached: true,
      widget: {
        widget_type: data.widget_type,
        html_code: data.widget_code,
        ...data.metadata,
        from_cache: true,
        cache_hit_count: data.hit_count + 1,
      },
    };
  } catch (err) {
    logger.error('MCP: Cache fetch error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Generate cache key for widget parameters
 * @param {Object} params - Widget parameters
 * @returns {string} Cache hash
 */
export function generate_cache_key(params) {
  return generateWidgetHash(params);
}

// =============================================================================
// REAL-TIME ADAPTATION
// =============================================================================

/**
 * Process real-time signals and determine adaptation needed
 * @param {Object} signals - Real-time user signals
 * @returns {Object} Adaptation recommendations
 */
export function process_realtime_signals(signals) {
  const {
    incorrect_attempts = 0,
    time_spent = 'normal',
    hesitation_detected = false,
    confidence = 'stable',
    last_interaction_type = null,
  } = signals;

  const adaptations = {
    reduce_difficulty: false,
    show_hints: false,
    slow_pace: false,
    switch_widget_type: false,
    add_scaffolding: false,
    recommended_widget_type: null,
  };

  // Analyze signals
  if (incorrect_attempts >= 3) {
    adaptations.reduce_difficulty = true;
    adaptations.show_hints = true;
    adaptations.add_scaffolding = true;
  } else if (incorrect_attempts >= 2) {
    adaptations.show_hints = true;
  }

  if (time_spent === 'high' || hesitation_detected) {
    adaptations.slow_pace = true;
    adaptations.show_hints = true;
  }

  if (confidence === 'decreasing') {
    adaptations.reduce_difficulty = true;
    adaptations.add_scaffolding = true;
  }

  // Recommend widget type switch if heavily struggling
  if (incorrect_attempts >= 4 && hesitation_detected) {
    adaptations.switch_widget_type = true;
    adaptations.recommended_widget_type = 'step-by-step-animation';
  }

  return {
    signals_processed: signals,
    adaptations,
    urgency: incorrect_attempts >= 3 ? 'high' : incorrect_attempts >= 2 ? 'medium' : 'low',
  };
}

// =============================================================================
// COMPREHENSION CHECK GENERATION
// =============================================================================

/**
 * Generate comprehension check widget
 * @param {Object} params - { topic, difficulty, conceptsTested }
 * @returns {Object} Comprehension widget definition
 */
export function generate_comprehension_check(params) {
  const { topic, difficulty = 'intermediate', conceptsTested = [] } = params;

  return {
    widget_type: 'quiz-widget',
    purpose: 'comprehension_check',
    topic,
    difficulty,
    structure: {
      prediction_question: {
        type: 'prediction',
        prompt: `Before we continue: What do you think will happen when...?`,
        captures: ['answer', 'confidence_level', 'response_time'],
      },
      application_question: {
        type: 'application',
        prompt: `Given what you learned, how would you apply this to...?`,
        format: 'multiple_choice_with_explanation',
        captures: ['answer', 'reasoning', 'response_time'],
      },
      optional_interaction: {
        type: 'drag-drop',
        prompt: 'Match the concepts to their definitions:',
        items: conceptsTested,
      },
    },
    updates_on_completion: {
      topic_strength: true,
      user_confidence: true,
      weak_topics_if_failed: true,
      strong_topics_if_passed: true,
    },
    pass_threshold: 0.7,
  };
}

// =============================================================================
// EXPORT ALL TOOLS
// =============================================================================

export const MCP_TOOLS = {
  run_widget_analytics,
  update_user_profile,
  store_widget_cache,
  get_cached_widget,
  generate_cache_key,
  process_realtime_signals,
  generate_comprehension_check,
};

export default MCP_TOOLS;
