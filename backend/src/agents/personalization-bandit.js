import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { supabase } from '../database/client.js';
import {
  deriveConfidence,
  derivePreviousFailures,
  deriveResponseTime,
  deriveTopicDifficulty,
} from '../bandit/context.js';

const ACTIONS = [
  'visual_widget',
  'guided_steps',
  'quiz_check',
  'text_explanation',
  'socratic_questioning',
  'remediation',
];
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_COMPONENT_SCORE = 0.5;

const decisionStore = new Map();
const statsStore = new Map();
const sessionStore = new Map();
const timeoutStore = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildStatsKey(scope, contextKey, action) {
  return `${scope}::${contextKey}::${action}`;
}

function buildSessionKey(userId, conversationId) {
  return `${userId || 'anon'}::${conversationId || 'default'}`;
}

function buildDecisionId() {
  return crypto.randomUUID();
}

function serializeDecision(decision) {
  return {
    id: decision.id,
    user_id: decision.userId,
    conversation_id: decision.conversationId,
    topic_key: decision.topicKey,
    topic_label: decision.topicLabel,
    context_key: decision.contextKey,
    selected_action: decision.selectedAction,
    decision_source: decision.decisionSource,
    confidence_level: decision.confidenceLevel,
    epsilon_used: decision.epsilonUsed,
    reward_status: decision.rewardStatus,
    learning_component: decision.learningComponent,
    engagement_component: decision.engagementComponent,
    completion_component: decision.completionComponent,
    final_reward: decision.finalReward,
    created_at: decision.createdAt,
    resolved_at: decision.resolvedAt || null,
    shadow: decision.shadow,
  };
}

async function persistDecisionSnapshot(decision) {
  try {
    await supabase.from('bandit_decisions').upsert(serializeDecision(decision));
  } catch (error) {
    logger.debug('[bandit] decision persistence skipped', { decisionId: decision.id, error: error.message });
  }
}

async function persistActionStats(scope, contextKey, action, stats) {
  try {
    await supabase.from('bandit_action_stats').upsert({
      user_id: scope === 'global' ? null : scope,
      context_key: contextKey,
      action,
      q_value: stats.qValue,
      count: stats.count,
      updated_at: stats.updatedAt,
    });
  } catch (error) {
    logger.debug('[bandit] stats persistence skipped', { scope, contextKey, action, error: error.message });
  }
}

async function persistSessionState(userId, conversationId, state) {
  if (!userId && !conversationId) return;
  try {
    await supabase.from('bandit_session_state').upsert({
      user_id: userId,
      conversation_id: conversationId,
      last_topic_key: state.lastTopicKey,
      last_action: state.lastAction,
      action_streak: state.actionStreak,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.debug('[bandit] session persistence skipped', { userId, conversationId, error: error.message });
  }
}

function getBanditConfig() {
  // BANDIT IS NOW AUTHORITATIVE - control enabled by default
  // Shadow mode disabled by default (only for A/B testing or debugging)
  return {
    shadowEnabled: process.env.PERSONALIZATION_BANDIT_SHADOW === 'true',
    controlEnabled: process.env.PERSONALIZATION_BANDIT_CONTROL !== 'false',
    timeoutMs: Number(process.env.PERSONALIZATION_BANDIT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

function normalizeTopicLabel(topic = '') {
  return topic
    .toLowerCase()
    .replace(/\b(please|about|learn|understand|explain|help with|teach me|topic|studying|can you|what is|how does|why does|how do|example|examples|work|works|working|quiz me|show me|give me)\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeTopicKey(topic, lastTopicKey = null) {
  const topicLabel = (topic || '').trim();
  const normalized = normalizeTopicLabel(topicLabel);
  const genericFollowUps = new Set(['give', 'show', 'quiz', 'another', 'continue', 'help', 'example']);

  if (!normalized || genericFollowUps.has(normalized)) {
    return {
      topicKey: lastTopicKey || 'general',
      topicLabel: topicLabel || lastTopicKey || 'general',
      confidence: 'low',
      reusedPrevious: Boolean(lastTopicKey),
    };
  }

  const confidence = normalized.split(' ').length > 1 || normalized.length > 6 ? 'high' : 'low';
  return {
    topicKey: normalized.replace(/\s+/g, '-').slice(0, 80),
    topicLabel: normalized,
    confidence,
    reusedPrevious: false,
  };
}

function topicMatches(topic, topicList = []) {
  if (!topic || !topicList.length) return false;
  const normalized = topic.toLowerCase();
  return topicList.some((candidate) => normalized.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalized));
}

function deriveEngagementLevel(metrics = null, behavior = null) {
  const engagementScore = metrics?.engagement?.score != null
    ? clamp(metrics.engagement.score / 100, 0, 1)
    : null;

  const interactionCount = behavior?.totalInteractions ?? behavior?.widgetInteractionCount ?? 0;
  const followUps = behavior?.followUpCount ?? 0;
  const avgMessageDuration = behavior?.avgMessageDuration ?? 0;

  let derivedScore = engagementScore;
  if (derivedScore == null) {
    derivedScore = 0.5;
    if (interactionCount >= 4) derivedScore += 0.2;
    if (followUps >= 2) derivedScore += 0.1;
    if (avgMessageDuration > 8000) derivedScore += 0.1;
    derivedScore = clamp(derivedScore, 0, 1);
  }

  if (derivedScore < 0.4) return 'low';
  if (derivedScore < 0.7) return 'medium';
  return 'high';
}

function deriveTopicStatus(profile = {}, topicLabel = '') {
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  if (topicMatches(topicLabel, weakTopics)) return 'weak';
  if (topicMatches(topicLabel, strongTopics)) return 'strong';
  return 'neutral';
}

function derivePerformanceTrend(topicHistory = null) {
  const trend = topicHistory?.trend || 'stable';
  if (trend === 'stagnating') return 'stable';
  if (trend === 'declining' || trend === 'improving') return trend;
  return 'stable';
}

export function deriveBanditContext({
  profile = {},
  metrics = null,
  adaptiveContext = null,
  topicHistory = null,
  topicLabel = '',
  behavior = null,
} = {}) {
  const cognitiveState = adaptiveContext?.cognitive_state || 'flow';
  const engagementLevel = deriveEngagementLevel(metrics, behavior);
  const topicStatus = deriveTopicStatus(profile, topicLabel);
  const performanceTrend = derivePerformanceTrend(topicHistory);
  const confidence = deriveConfidence(metrics, adaptiveContext, topicHistory);
  const topicDifficulty = deriveTopicDifficulty(metrics, adaptiveContext, topicHistory);
  const previousFailures = derivePreviousFailures(metrics, adaptiveContext, topicHistory);
  const responseTime = deriveResponseTime(metrics, behavior);
  const contextKey = [
    cognitiveState,
    engagementLevel,
    topicStatus,
    performanceTrend,
    confidence.toFixed(2),
    topicDifficulty.toFixed(2),
    previousFailures.toFixed(2),
    responseTime.toFixed(2),
  ].join('|');

  return {
    cognitiveState,
    engagementLevel,
    topicStatus,
    performanceTrend,
    confidence,
    topicDifficulty,
    previousFailures,
    responseTime,
    contextKey,
  };
}

function getPriorValue(context, action) {
  let prior = 0;
  if ((context.cognitiveState === 'struggling' || context.cognitiveState === 'confused') && action === 'guided_steps') prior += 0.1;
  if ((context.cognitiveState === 'struggling' || context.cognitiveState === 'confused') && action === 'remediation') prior += 0.08;
  if (context.cognitiveState === 'mastering' && action === 'quiz_check') prior += 0.1;
  if (context.cognitiveState === 'mastering' && action === 'socratic_questioning') prior += 0.05;
  if (context.cognitiveState === 'flow' && (action === 'visual_widget' || action === 'text_explanation')) prior += 0.05;
  if (context.topicStatus === 'weak' && action === 'guided_steps') prior += 0.1;
  if (context.topicStatus === 'weak' && action === 'remediation') prior += 0.08;
  if (context.topicStatus === 'strong' && action === 'quiz_check') prior += 0.05;
  return prior;
}

function getActionStats(scope, contextKey, action) {
  return statsStore.get(buildStatsKey(scope, contextKey, action)) || null;
}

function getContextSampleCount(userId, contextKey) {
  const userScope = userId || 'global';
  const counts = ACTIONS.map((action) => {
    const userStats = getActionStats(userScope, contextKey, action);
    if (userStats) return userStats.count;
    const globalStats = getActionStats('global', contextKey, action);
    return globalStats?.count || 0;
  });
  return counts.reduce((sum, count) => sum + count, 0);
}

export function computeContextConfidence(sampleCount = 0) {
  if (sampleCount < 5) return 'low';
  if (sampleCount < 20) return 'medium';
  return 'high';
}

function getEpsilon(confidenceLevel) {
  if (confidenceLevel === 'low') return 0.3;
  if (confidenceLevel === 'medium') return 0.2;
  return 0.1;
}

function evaluateAction(scopeUserId, contextKey, context, action) {
  const userStats = getActionStats(scopeUserId || 'global', contextKey, action);
  const globalStats = getActionStats('global', contextKey, action);
  const base = getPriorValue(context, action);

  if (userStats) {
    return { action, value: userStats.qValue, source: 'user', count: userStats.count };
  }
  if (globalStats) {
    return { action, value: globalStats.qValue, source: 'global', count: globalStats.count };
  }
  return { action, value: base, source: 'prior', count: 0 };
}

function getSessionState(userId, conversationId) {
  return sessionStore.get(buildSessionKey(userId, conversationId)) || {
    lastTopicKey: null,
    lastAction: null,
    actionStreak: 0,
    lastDecisionId: null,
    lastPartialReward: null,
  };
}

function setSessionState(userId, conversationId, nextState) {
  sessionStore.set(buildSessionKey(userId, conversationId), nextState);
  void persistSessionState(userId, conversationId, nextState);
}

function shouldBreakLock(sessionState, context) {
  if (!sessionState?.lastAction || sessionState.actionStreak >= 2) {
    return true;
  }

  if (context.cognitiveState === 'struggling' || context.cognitiveState === 'confused') {
    return true;
  }

  if (context.engagementLevel === 'low') {
    return true;
  }

  if (sessionState.lastPartialReward != null && sessionState.lastPartialReward < -0.2) {
    return true;
  }

  const lastDecision = sessionState.lastDecisionId ? decisionStore.get(sessionState.lastDecisionId) : null;
  if (lastDecision?.learningComponent === 0) {
    return true;
  }

  return false;
}

function selectActionForContext({ userId, conversationId, topicKey, context }) {
  const sampleCount = getContextSampleCount(userId, context.contextKey);
  const confidenceLevel = computeContextConfidence(sampleCount);
  const epsilon = getEpsilon(confidenceLevel);
  const sessionState = getSessionState(userId, conversationId);

  if (sessionState.lastTopicKey === topicKey && sessionState.lastAction && !shouldBreakLock(sessionState, context)) {
    return {
      selectedAction: sessionState.lastAction,
      decisionSource: 'locked',
      confidenceLevel,
      epsilonUsed: 0,
      sampleCount,
      actionScores: ACTIONS.map((action) => evaluateAction(userId, context.contextKey, context, action)),
      actionStreak: sessionState.actionStreak,
    };
  }

  const actionScores = ACTIONS
    .map((action) => evaluateAction(userId, context.contextKey, context, action))
    .sort((left, right) => right.value - left.value);

  const isExploring = Math.random() < epsilon;
  const selectedAction = isExploring && actionScores.length > 1
    ? actionScores[1].action
    : actionScores[0].action;

  return {
    selectedAction,
    decisionSource: isExploring ? 'explore' : 'exploit',
    confidenceLevel,
    epsilonUsed: epsilon,
    sampleCount,
    actionScores,
    actionStreak: sessionState.lastTopicKey === topicKey && sessionState.lastAction === selectedAction
      ? sessionState.actionStreak + 1
      : 1,
  };
}

export function logBanditDecisionLifecycle(eventType, payload = {}) {
  logger.info(`[bandit] ${eventType}`, {
    decisionId: payload.decisionId,
    topicKey: payload.topicKey,
    selectedAction: payload.selectedAction,
    rewardStatus: payload.rewardStatus,
    learningComponent: payload.learningComponent,
    engagementComponent: payload.engagementComponent,
    completionComponent: payload.completionComponent,
    finalReward: payload.finalReward,
    metadata: payload.metadata,
  });
}

function computeReward(decision, applyDefaults = true) {
  const learning = decision.learningComponent ?? (applyDefaults ? DEFAULT_COMPONENT_SCORE : null);
  const engagement = decision.engagementComponent ?? (applyDefaults ? DEFAULT_COMPONENT_SCORE : null);
  const completion = decision.completionComponent ?? (applyDefaults ? DEFAULT_COMPONENT_SCORE : null);

  if ([learning, engagement, completion].some((value) => value == null)) {
    return { reward01: null, normalizedReward: null };
  }

  const reward01 = clamp((learning * 0.5) + (engagement * 0.3) + (completion * 0.2), 0, 1);
  return {
    reward01,
    normalizedReward: clamp((reward01 * 2) - 1, -1, 1),
  };
}

function updateStats(scope, contextKey, action, reward) {
  const key = buildStatsKey(scope, contextKey, action);
  const current = statsStore.get(key) || { qValue: 0, count: 0 };
  const nextCount = current.count + 1;
  const nextQ = current.qValue + ((reward - current.qValue) / nextCount);
  const nextStats = { qValue: nextQ, count: nextCount, updatedAt: new Date().toISOString() };
  statsStore.set(key, nextStats);
  void persistActionStats(scope, contextKey, action, nextStats);
}

function finalizeDecision(decisionId, resolutionType = 'decision_resolved') {
  const decision = decisionStore.get(decisionId);
  if (!decision || decision.rewardStatus === 'resolved') {
    return decision;
  }

  if (timeoutStore.has(decisionId)) {
    clearTimeout(timeoutStore.get(decisionId));
    timeoutStore.delete(decisionId);
  }

  const { reward01, normalizedReward } = computeReward(decision, true);
  decision.rewardStatus = 'resolved';
  decision.finalReward = normalizedReward;
  decision.reward01 = reward01;
  decision.resolvedAt = new Date().toISOString();
  decisionStore.set(decisionId, decision);
  void persistDecisionSnapshot(decision);

  updateStats(decision.userId || 'global', decision.contextKey, decision.selectedAction, normalizedReward);
  updateStats('global', decision.contextKey, decision.selectedAction, normalizedReward);

  const sessionState = getSessionState(decision.userId, decision.conversationId);
  if (sessionState.lastDecisionId === decisionId) {
    setSessionState(decision.userId, decision.conversationId, {
      ...sessionState,
      lastPartialReward: normalizedReward,
    });
  }

  logBanditDecisionLifecycle(resolutionType, decision);
  return decision;
}

function scheduleTimeout(decisionId, timeoutMs) {
  if (timeoutStore.has(decisionId)) {
    clearTimeout(timeoutStore.get(decisionId));
  }

  const handle = setTimeout(() => {
    finalizeDecision(decisionId, 'decision_timeout_resolved');
  }, timeoutMs);

  timeoutStore.set(decisionId, handle);
}

export function createBanditDecision({
  userId = null,
  conversationId = null,
  topicKey,
  topicLabel,
  context,
  selectedAction,
  decisionSource,
  confidenceLevel,
  epsilonUsed,
  shadow = true,
  timeoutMs,
} = {}) {
  const decisionId = buildDecisionId();
  const decision = {
    id: decisionId,
    userId,
    conversationId,
    topicKey,
    topicLabel,
    contextKey: context.contextKey,
    context,
    selectedAction,
    decisionSource,
    confidenceLevel,
    epsilonUsed,
    rewardStatus: 'pending',
    learningComponent: null,
    engagementComponent: null,
    completionComponent: null,
    finalReward: null,
    createdAt: new Date().toISOString(),
    shadow,
    seenSources: new Set(),
  };

  decisionStore.set(decisionId, decision);
  void persistDecisionSnapshot(decision);

  const sessionState = getSessionState(userId, conversationId);
  setSessionState(userId, conversationId, {
    lastTopicKey: topicKey,
    lastAction: selectedAction,
    actionStreak: sessionState.lastTopicKey === topicKey && sessionState.lastAction === selectedAction
      ? sessionState.actionStreak + 1
      : 1,
    lastDecisionId: decisionId,
    lastPartialReward: sessionState.lastPartialReward ?? null,
  });

  scheduleTimeout(decisionId, timeoutMs ?? getBanditConfig().timeoutMs);
  logBanditDecisionLifecycle(shadow ? 'decision_created_shadow' : 'decision_created', decision);
  return decision;
}

export function updateBanditDecisionComponent(decisionId, componentName, value, options = {}) {
  const decision = decisionStore.get(decisionId);
  if (!decision) {
    logBanditDecisionLifecycle('decision_update_skipped', {
      decisionId,
      metadata: { reason: 'missing_decision', componentName, source: options.source },
    });
    return null;
  }

  if (decision.rewardStatus === 'resolved') {
    logBanditDecisionLifecycle('decision_update_skipped', {
      ...decision,
      metadata: { reason: 'already_resolved', componentName, source: options.source },
    });
    return decision;
  }

  const sourceKey = options.sourceKey || `${options.source || componentName}:${options.eventId || 'default'}`;
  if (decision.seenSources.has(sourceKey)) {
    logBanditDecisionLifecycle('decision_update_skipped', {
      ...decision,
      metadata: { reason: 'duplicate_source', componentName, sourceKey },
    });
    return decision;
  }

  decision.seenSources.add(sourceKey);
  decision[componentName] = clamp(value, 0, 1);

  const partial = computeReward(decision, false);
  const sessionState = getSessionState(decision.userId, decision.conversationId);
  if (partial.normalizedReward != null && sessionState.lastDecisionId === decision.id) {
    setSessionState(decision.userId, decision.conversationId, {
      ...sessionState,
      lastPartialReward: partial.normalizedReward,
    });
  }

  decisionStore.set(decisionId, decision);
  void persistDecisionSnapshot(decision);
  logBanditDecisionLifecycle(`${componentName}_updated`, decision);
  return decision;
}

export function resolveBanditDecision(decisionId) {
  return finalizeDecision(decisionId, 'decision_resolved');
}

export function recordBanditQuizAnswer({
  decisionId,
  isCorrect,
  source = 'quiz_answer',
  eventId = null,
} = {}) {
  if (!decisionId) {
    return null;
  }

  const decision = updateBanditDecisionComponent(
    decisionId,
    'learningComponent',
    isCorrect ? 1 : 0,
    { source, eventId }
  );

  if (decision && decision.selectedAction === 'quiz_check' && decision.completionComponent == null) {
    updateBanditDecisionComponent(decisionId, 'completionComponent', 1, {
      source: `${source}_completion`,
      eventId: eventId || 'quiz_completion',
    });
  }

  return decisionStore.get(decisionId);
}

function deriveEngagementScoreFromData(interactionType, data = {}) {
  let score = 0.5;
  const interactions = Number(data.interactions ?? data.interactionCount ?? 0);
  const totalTimeMs = Number(data.totalTime ?? data.elapsedMs ?? 0);
  const hintsUsed = Number(data.hintsUsed ?? 0);
  const errorsCount = Number(data.errorsCount ?? 0);

  if (interactions > 0 && totalTimeMs >= 5000) score += 0.15;
  if (interactions >= 4) score += 0.15;
  if (data.action === 'complete' || interactionType === 'widget_analytics') score += 0.05;
  score -= Math.min(0.2, hintsUsed * 0.05);
  score -= Math.min(0.3, errorsCount * 0.08);

  return clamp(score, 0, 1);
}

function deriveCompletionScore(interactionType, data = {}) {
  if (data.completionRate != null) {
    return clamp(Number(data.completionRate), 0, 1);
  }
  if (data.action === 'complete') return 1;
  if (interactionType === 'abandon' || data.abandoned) return 0;
  return null;
}

export function recordBanditInteraction({
  decisionId,
  interactionType,
  data = {},
  source = 'interaction',
  eventId = null,
} = {}) {
  if (!decisionId) {
    return null;
  }

  const engagementScore = deriveEngagementScoreFromData(interactionType, data);
  updateBanditDecisionComponent(decisionId, 'engagementComponent', engagementScore, {
    source: `${source}_engagement`,
    eventId,
  });

  const completionScore = deriveCompletionScore(interactionType, data);
  if (completionScore != null) {
    updateBanditDecisionComponent(decisionId, 'completionComponent', completionScore, {
      source: `${source}_completion`,
      eventId,
    });
  }

  const decision = decisionStore.get(decisionId);
  if (decision?.learningComponent != null && (decision.completionComponent != null || completionScore != null)) {
    return finalizeDecision(decisionId, 'decision_resolved');
  }

  return decision;
}

export function getBanditDecision(decisionId) {
  return decisionStore.get(decisionId) || null;
}

export function getBanditActionPrompt(decision) {
  if (!decision) return '';

  const promptMap = {
    visual_widget: [
      'BANDIT ACTION: visual_widget',
      'Prefer a widget-first explanation when helpful.',
      'Use the show_widget tool for interactive explanation before long prose.',
    ],
    guided_steps: [
      'BANDIT ACTION: guided_steps',
      'Respond with scaffolded step-by-step teaching.',
      'Break the concept into smaller steps and slow the pace.',
    ],
    quiz_check: [
      'BANDIT ACTION: quiz_check',
      'Insert a brief comprehension check before moving forward.',
      'Use a question or mini-check to confirm understanding.',
    ],
    text_explanation: [
      'BANDIT ACTION: text_explanation',
      'Prefer a clear text explanation without forcing a widget.',
      'Focus on concise clarity and examples in prose.',
    ],
    socratic_questioning: [
      'BANDIT ACTION: socratic_questioning',
      'Guide with at least two meaningful questions before direct explanation.',
      'Avoid starting with direct-answer phrases such as "the answer is".',
    ],
    remediation: [
      'BANDIT ACTION: remediation',
      'Identify the likely mistake or misconception explicitly.',
      'Give a corrected explanation and restate the idea in simpler terms.',
    ],
  };

  return `\n---\n${promptMap[decision.selectedAction]?.join('\n') || ''}\n---`;
}

export function getBanditMode() {
  return getBanditConfig();
}

export function getBanditDecisionEnvelope({
  userId = null,
  conversationId = null,
  topic = null,
  profile = {},
  metrics = null,
  adaptiveContext = null,
  topicHistory = null,
  behavior = null,
  existingTopicKey = null,
} = {}) {
  const sessionState = getSessionState(userId, conversationId);
  const fallbackTopicKey = existingTopicKey || sessionState.lastTopicKey || null;
  const topicInfo = canonicalizeTopicKey(topic, fallbackTopicKey);
  const context = deriveBanditContext({
    profile,
    metrics,
    adaptiveContext,
    topicHistory,
    topicLabel: topicInfo.topicLabel,
    behavior,
  });
  const selection = selectActionForContext({
    userId,
    conversationId,
    topicKey: topicInfo.topicKey,
    context,
  });

  return {
    topicInfo,
    context,
    selection,
  };
}
