/**
 * Context Standardization Module
 * Generates numeric context vectors for LinUCB algorithm
 */

// Context version - increment when adding features
export const CONTEXT_VERSION = 1;

// Context dimension (must match LinUCB initialization)
export const CONTEXT_DIM = 4;

// Public enums used across modules
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

// Cognitive state encodings
const COGNITIVE_STATE_MAP = {
  struggling: 0,
  confused: 1,
  flow: 2,
  bored: 3,
  mastering: 4,
};

// Engagement level encodings
const ENGAGEMENT_LEVEL_MAP = {
  low: 0,
  medium: 1,
  high: 2,
};

// Topic status encodings
const TOPIC_STATUS_MAP = {
  weak: -1,
  neutral: 0,
  strong: 1,
};

// Performance trend encodings
const PERFORMANCE_TREND_MAP = {
  declining: -1,
  stable: 0,
  improving: 1,
};

/**
 * Encode cognitive state to numeric value
 */
export function encodeCognitiveState(state) {
  return COGNITIVE_STATE_MAP[state] ?? COGNITIVE_STATE_MAP.flow;
}

/**
 * Encode engagement level to numeric value
 */
export function encodeEngagementLevel(level) {
  return ENGAGEMENT_LEVEL_MAP[level] ?? ENGAGEMENT_LEVEL_MAP.medium;
}

/**
 * Encode topic status to numeric value
 */
export function encodeTopicStatus(status) {
  return TOPIC_STATUS_MAP[status] ?? TOPIC_STATUS_MAP.neutral;
}

/**
 * Encode performance trend to numeric value
 */
export function encodePerformanceTrend(trend) {
  return PERFORMANCE_TREND_MAP[trend] ?? PERFORMANCE_TREND_MAP.stable;
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Derive engagement level from metrics and behavior
 */
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

/**
 * Check if topic matches any in a list (fuzzy match)
 */
function topicMatches(topic, topicList = []) {
  if (!topic || !topicList.length) return false;
  const normalized = topic.toLowerCase();
  return topicList.some(
    (candidate) => normalized.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalized)
  );
}

/**
 * Derive topic status from profile
 */
export function deriveTopicStatus(profile = {}, topicLabel = '') {
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  if (topicMatches(topicLabel, weakTopics)) return 'weak';
  if (topicMatches(topicLabel, strongTopics)) return 'strong';
  return 'neutral';
}

/**
 * Derive performance trend from topic history
 */
export function derivePerformanceTrend(topicHistory = null) {
  const trend = topicHistory?.trend || 'stable';
  if (trend === 'stagnating') return 'stable';
  if (trend === 'declining' || trend === 'improving') return trend;
  return 'stable';
}

/**
 * Derive full numeric context from user state
 * Returns both human-readable labels and numeric vector for LinUCB
 *
 * @param {Object} userState - User state object
 * @param {Object} userState.profile - User profile with weak/strong topics
 * @param {Object} userState.metrics - User metrics including engagement
 * @param {Object} userState.adaptiveContext - Adaptive context with cognitive state
 * @param {Object} userState.topicHistory - Topic history with trend
 * @param {string} userState.topicLabel - Current topic label
 * @param {Object} userState.behavior - User behavior data
 * @returns {Object} Context object with vector and labels
 */
export function deriveNumericContext({
  profile = {},
  metrics = null,
  adaptiveContext = null,
  topicHistory = null,
  topicLabel = '',
  behavior = null,
} = {}) {
  // Derive string labels first
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

  // Convert to numeric values
  const cognitiveState = encodeCognitiveState(cognitiveStateLabel);
  const engagementLevel = encodeEngagementLevel(engagementLevelLabel);
  const topicStatus = encodeTopicStatus(topicStatusLabel);
  const performanceTrend = encodePerformanceTrend(performanceTrendLabel);

  // Build context vector for LinUCB (order matters!)
  const vector = [cognitiveState, engagementLevel, topicStatus, performanceTrend];

  // Build context key for logging and caching
  const contextKey = `${cognitiveState}|${engagementLevel}|${topicStatus}|${performanceTrend}`;

  return {
    // Numeric values
    cognitiveState,
    engagementLevel,
    topicStatus,
    performanceTrend,
    // Vector for LinUCB
    vector,
    // String labels for readability
    labels: {
      cognitiveState: cognitiveStateLabel,
      engagementLevel: engagementLevelLabel,
      topicStatus: topicStatusLabel,
      performanceTrend: performanceTrendLabel,
    },
    // Keys for logging/caching
    contextKey,
    version: CONTEXT_VERSION,
  };
}

/**
 * Normalize context vector for LinUCB
 * Ensures values are in reasonable ranges for matrix operations
 */
export function normalizeContextVector(vector) {
  // Normalize each dimension to [-1, 1] range
  const normalized = [
    (vector[0] - 2) / 2,      // cognitiveState: [0,4] -> [-1, 1]
    (vector[1] - 1) / 1,      // engagementLevel: [0,2] -> [-1, 1]
    vector[2],                 // topicStatus: already [-1, 1]
    vector[3],                 // performanceTrend: already [-1, 1]
  ];
  return normalized;
}

/**
 * Extended context features for future expansion
 * Not used in v1, but designed for easy addition
 */
export function deriveExtendedContext(userState, options = {}) {
  const core = deriveNumericContext(userState);

  if (!options.includeExtended) {
    return core;
  }

  // Future features (v2):
  const sessionLength = normalizeSessionLength(userState.sessionDurationMs);
  const difficultyLevel = userState.currentDifficulty ?? 1;

  return {
    ...core,
    sessionLength,
    difficultyLevel,
    vector: [...core.vector, sessionLength, difficultyLevel],
    version: CONTEXT_VERSION,
  };
}

/**
 * Normalize session length to [0, 1]
 */
function normalizeSessionLength(durationMs) {
  if (!durationMs) return 0.5;
  // Short: < 5 min, Medium: 5-15 min, Long: > 15 min
  const minutes = durationMs / 60000;
  if (minutes < 5) return 0.2;
  if (minutes < 15) return 0.5;
  return 0.8;
}
