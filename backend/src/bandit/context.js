/**
 * Context Standardization Module
 * Generates numeric context vectors for the LinUCB policy.
 */

// Context version - increment when adding or reordering features.
export const CONTEXT_VERSION = 2;

// Context dimension (must match LinUCB initialization).
export const CONTEXT_DIM = 8;

// Public enums used across modules.
export const COGNITIVE_STATES = {
  STRUGGLING: 'struggling',
  CONFUSED: 'confused',
  FLOW: 'flow',
  BORED: 'bored',
  MASTERING: 'mastering',
};

export const ENGAGEMENT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const COGNITIVE_STATE_MAP = {
  struggling: 0,
  confused: 1,
  flow: 2,
  bored: 3,
  mastering: 4,
};

const ENGAGEMENT_LEVEL_MAP = {
  low: 0,
  medium: 1,
  high: 2,
};

const TOPIC_STATUS_MAP = {
  weak: -1,
  neutral: 0,
  strong: 1,
};

const PERFORMANCE_TREND_MAP = {
  declining: -1,
  stable: 0,
  improving: 1,
};

const TOPIC_DIFFICULTY_MAP = {
  foundational: 0.25,
  beginner: 0.25,
  basic: 0.25,
  easy: 0.25,
  intermediate: 0.5,
  medium: 0.5,
  moderate: 0.5,
  advanced: 0.75,
  high: 0.75,
  hard: 0.75,
  expert: 1.0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp01(value, fallback = 0.5) {
  const numeric = finiteNumber(value, fallback);
  return clamp(numeric, 0, 1);
}

function pickNumber(sources, fallback = null) {
  for (const value of sources) {
    const numeric = finiteNumber(value, null);
    if (numeric != null) return numeric;
  }
  return fallback;
}

export function encodeCognitiveState(state) {
  return COGNITIVE_STATE_MAP[state] ?? COGNITIVE_STATE_MAP.flow;
}

export function encodeEngagementLevel(level) {
  return ENGAGEMENT_LEVEL_MAP[level] ?? ENGAGEMENT_LEVEL_MAP.medium;
}

export function encodeTopicStatus(status) {
  return TOPIC_STATUS_MAP[status] ?? TOPIC_STATUS_MAP.neutral;
}

export function encodePerformanceTrend(trend) {
  return PERFORMANCE_TREND_MAP[trend] ?? PERFORMANCE_TREND_MAP.stable;
}

export function encodeTopicDifficulty(difficulty) {
  if (typeof difficulty === 'number') return clamp01(difficulty, 0.5);
  const normalized = String(difficulty || '').trim().toLowerCase();
  return TOPIC_DIFFICULTY_MAP[normalized] ?? 0.5;
}

export function deriveEngagementLevel(metrics = null, behavior = null) {
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

function topicMatches(topic, topicList = []) {
  if (!topic || !topicList.length) return false;
  const normalized = topic.toLowerCase();
  return topicList.some(
    (candidate) => normalized.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalized)
  );
}

export function deriveTopicStatus(profile = {}, topicLabel = '') {
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  if (topicMatches(topicLabel, weakTopics)) return 'weak';
  if (topicMatches(topicLabel, strongTopics)) return 'strong';
  return 'neutral';
}

export function derivePerformanceTrend(topicHistory = null) {
  const trend = topicHistory?.trend || 'stable';
  if (trend === 'stagnating') return 'stable';
  if (trend === 'declining' || trend === 'improving') return trend;
  return 'stable';
}

export function deriveConfidence(metrics = null, adaptiveContext = null, topicHistory = null) {
  const quizAccuracy = pickNumber([
    metrics?.quizAccuracy,
    metrics?.quiz_accuracy,
    metrics?.accuracy,
    metrics?.correctRate,
    adaptiveContext?.quizAccuracy,
    adaptiveContext?.quiz_accuracy,
  ], null);

  if (quizAccuracy != null) return clamp01(quizAccuracy, 0.5);

  const masteryLevel = clamp01(pickNumber([
    topicHistory?.masteryLevel,
    topicHistory?.mastery_level,
    adaptiveContext?.masteryLevel,
    adaptiveContext?.mastery_level,
    metrics?.masteryLevel,
  ], 0.5), 0.5);

  const attemptCount = pickNumber([
    topicHistory?.attemptCount,
    topicHistory?.attempt_count,
    adaptiveContext?.attemptCount,
    adaptiveContext?.attempt_count,
    metrics?.attemptCount,
  ], null);
  const successCount = pickNumber([
    topicHistory?.successCount,
    topicHistory?.success_count,
    adaptiveContext?.successCount,
    adaptiveContext?.success_count,
    metrics?.successCount,
  ], null);

  const successRate = attemptCount != null && successCount != null
    ? clamp01(successCount / Math.max(attemptCount, 1), 0.5)
    : clamp01(pickNumber([
      topicHistory?.successRate,
      topicHistory?.success_rate,
      adaptiveContext?.successRate,
      adaptiveContext?.success_rate,
      metrics?.successRate,
    ], 0.5), 0.5);

  return clamp01((0.7 * masteryLevel) + (0.3 * successRate), 0.5);
}

export function deriveTopicDifficulty(metrics = null, adaptiveContext = null, topicHistory = null) {
  const difficulty = metrics?.topicDifficulty ??
    metrics?.difficulty ??
    metrics?.currentDifficulty ??
    adaptiveContext?.topicDifficulty ??
    adaptiveContext?.difficulty ??
    adaptiveContext?.currentDifficulty ??
    topicHistory?.topicDifficulty ??
    topicHistory?.difficulty ??
    topicHistory?.currentDifficulty;

  return encodeTopicDifficulty(difficulty);
}

export function derivePreviousFailures(metrics = null, adaptiveContext = null, topicHistory = null) {
  const attemptCount = pickNumber([
    topicHistory?.attemptCount,
    topicHistory?.attempt_count,
    adaptiveContext?.attemptCount,
    adaptiveContext?.attempt_count,
    metrics?.attemptCount,
    metrics?.attempt_count,
  ], 0);

  const successCount = pickNumber([
    topicHistory?.successCount,
    topicHistory?.success_count,
    adaptiveContext?.successCount,
    adaptiveContext?.success_count,
    metrics?.successCount,
    metrics?.success_count,
  ], 0);

  return clamp01((attemptCount - successCount) / Math.max(attemptCount, 1), 0);
}

export function deriveResponseTime(metrics = null, behavior = null) {
  const avgMessageDuration = pickNumber([
    behavior?.avgMessageDuration,
    behavior?.avg_message_duration,
    metrics?.avgMessageDuration,
    metrics?.avg_message_duration,
    metrics?.responseTimeMs,
    metrics?.response_time_ms,
  ], 15000);

  return clamp01(avgMessageDuration / 30000, 0.5);
}

/**
 * Derive full numeric context from user state.
 *
 * Vector order:
 * [cognitiveState, engagementLevel, topicStatus, performanceTrend,
 *  confidence, topicDifficulty, previousFailures, responseTime]
 */
export function deriveNumericContext({
  profile = {},
  metrics = null,
  adaptiveContext = null,
  topicHistory = null,
  topicLabel = '',
  behavior = null,
} = {}) {
  const cognitiveStateLabel =
    adaptiveContext?.cognitive_state ||
    adaptiveContext?.cognitiveState ||
    'flow';
  const engagementLevelLabel =
    metrics?.engagementLevel ||
    adaptiveContext?.engagement_level ||
    deriveEngagementLevel(metrics, behavior);
  const topicStatusLabel =
    metrics?.topicStatus ||
    deriveTopicStatus(profile, topicLabel);
  const performanceTrendLabel =
    metrics?.performanceTrend ||
    derivePerformanceTrend(topicHistory);

  const cognitiveState = encodeCognitiveState(cognitiveStateLabel);
  const engagementLevel = encodeEngagementLevel(engagementLevelLabel);
  const topicStatus = encodeTopicStatus(topicStatusLabel);
  const performanceTrend = encodePerformanceTrend(performanceTrendLabel);
  const confidence = deriveConfidence(metrics, adaptiveContext, topicHistory);
  const topicDifficulty = deriveTopicDifficulty(metrics, adaptiveContext, topicHistory);
  const previousFailures = derivePreviousFailures(metrics, adaptiveContext, topicHistory);
  const responseTime = deriveResponseTime(metrics, behavior);

  const vector = [
    cognitiveState,
    engagementLevel,
    topicStatus,
    performanceTrend,
    confidence,
    topicDifficulty,
    previousFailures,
    responseTime,
  ];

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
    vector,
    labels: {
      cognitiveState: cognitiveStateLabel,
      engagementLevel: engagementLevelLabel,
      topicStatus: topicStatusLabel,
      performanceTrend: performanceTrendLabel,
      confidence,
      topicDifficulty,
      previousFailures,
      responseTime,
    },
    contextKey,
    version: CONTEXT_VERSION,
  };
}

export function normalizeContextVector(vector) {
  const safe = Array.isArray(vector) ? vector : [];
  const normalized = [
    (finiteNumber(safe[0], 2) - 2) / 2,
    finiteNumber(safe[1], 1) - 1,
    finiteNumber(safe[2], 0),
    finiteNumber(safe[3], 0),
    (clamp01(safe[4], 0.5) * 2) - 1,
    (clamp01(safe[5], 0.5) * 2) - 1,
    (clamp01(safe[6], 0) * 2) - 1,
    (clamp01(safe[7], 0.5) * 2) - 1,
  ];

  return normalized.map((value) => finiteNumber(value, 0));
}

/**
 * Compatibility wrapper for older callers. Version 2 already includes the
 * previously planned extended features, so this returns the core context.
 */
export function deriveExtendedContext(userState) {
  return deriveNumericContext(userState);
}
