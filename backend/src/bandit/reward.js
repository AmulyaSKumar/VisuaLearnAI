/**
 * Reward Computation Module
 * Computes rewards from components and monitors for anomalies
 */

import { logger } from '../utils/logger.js';
import { ACTIONS } from './algorithm.js';

// Configurable weights for A/B testing different formulas
export const REWARD_WEIGHTS = {
  correctness: parseFloat(process.env.BANDIT_REWARD_W_CORRECTNESS || '0.4'),
  engagement: parseFloat(process.env.BANDIT_REWARD_W_ENGAGEMENT || '0.3'),
  completion: parseFloat(process.env.BANDIT_REWARD_W_COMPLETION || '0.2'),
  retention: parseFloat(process.env.BANDIT_REWARD_W_RETENTION || '0.1'),
};

// Default value when component is missing
const DEFAULT_COMPONENT_VALUE = 0.5;

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute reward from components
 * @param {Object} components - Reward components
 * @param {number} components.correctness - Quiz/validation accuracy [0, 1]
 * @param {number} components.engagement - Interaction depth [0, 1]
 * @param {number} components.completion - Task completion [0, 1]
 * @param {number} components.retention - Repeated success on topic [0, 1]
 * @param {boolean} applyDefaults - Use defaults for missing components
 * @returns {Object} Reward computation result
 */
export function computeReward(components, applyDefaults = true) {
  const {
    correctness = applyDefaults ? DEFAULT_COMPONENT_VALUE : null,
    engagement = applyDefaults ? DEFAULT_COMPONENT_VALUE : null,
    completion = applyDefaults ? DEFAULT_COMPONENT_VALUE : null,
    retention = applyDefaults ? DEFAULT_COMPONENT_VALUE : null,
  } = components;

  // Check if all required components are present
  const allPresent = [correctness, engagement, completion, retention].every(v => v != null);

  if (!allPresent && !applyDefaults) {
    return {
      reward: null,
      normalized: null,
      complete: false,
      components: { correctness, engagement, completion, retention },
    };
  }

  // Compute weighted reward
  const c = correctness ?? DEFAULT_COMPONENT_VALUE;
  const e = engagement ?? DEFAULT_COMPONENT_VALUE;
  const comp = completion ?? DEFAULT_COMPONENT_VALUE;
  const r = retention ?? DEFAULT_COMPONENT_VALUE;

  const reward = clamp(
    REWARD_WEIGHTS.correctness * c +
    REWARD_WEIGHTS.engagement * e +
    REWARD_WEIGHTS.completion * comp +
    REWARD_WEIGHTS.retention * r,
    0, 1
  );

  // Normalized to [-1, 1] for Q-value updates
  const normalized = clamp((reward * 2) - 1, -1, 1);

  return {
    reward,
    normalized,
    complete: true,
    components: { correctness: c, engagement: e, completion: comp, retention: r },
    weights: REWARD_WEIGHTS,
  };
}

/**
 * Derive engagement score from interaction data
 */
export function deriveEngagementScore(interactionType, data = {}) {
  let score = 0.5;

  const interactions = Number(data.interactions ?? data.interactionCount ?? 0);
  const totalTimeMs = Number(data.totalTime ?? data.elapsedMs ?? 0);
  const hintsUsed = Number(data.hintsUsed ?? 0);
  const errorsCount = Number(data.errorsCount ?? 0);

  // Positive signals
  if (interactions > 0 && totalTimeMs >= 5000) score += 0.15;
  if (interactions >= 4) score += 0.15;
  if (data.action === 'complete' || interactionType === 'widget_analytics') score += 0.05;

  // Negative signals
  score -= Math.min(0.2, hintsUsed * 0.05);
  score -= Math.min(0.3, errorsCount * 0.08);

  return clamp(score, 0, 1);
}

/**
 * Derive completion score from interaction data
 */
export function deriveCompletionScore(interactionType, data = {}) {
  if (data.completionRate != null) {
    return clamp(Number(data.completionRate), 0, 1);
  }
  if (data.action === 'complete') return 1;
  if (interactionType === 'abandon' || data.abandoned) return 0;
  return null; // Unknown
}

/**
 * Derive correctness score from quiz/validation data
 */
export function deriveCorrectnessScore(data = {}) {
  if (data.isCorrect !== undefined) {
    return data.isCorrect ? 1 : 0;
  }
  if (data.correctCount !== undefined && data.totalCount !== undefined) {
    return data.totalCount > 0 ? data.correctCount / data.totalCount : 0.5;
  }
  if (data.accuracy !== undefined) {
    return clamp(data.accuracy, 0, 1);
  }
  return null; // Unknown
}

/**
 * Derive retention score from topic history
 */
export function deriveRetentionScore(topicHistory = null, currentSuccess = null) {
  if (!topicHistory) {
    return currentSuccess != null ? currentSuccess : null;
  }

  const { consecutiveSuccesses = 0, lastSuccess = null, trend = 'stable' } = topicHistory;

  // High retention: multiple consecutive successes
  if (consecutiveSuccesses >= 3) return 1.0;
  if (consecutiveSuccesses >= 2) return 0.8;
  if (consecutiveSuccesses >= 1) return 0.6;

  // Factor in trend
  if (trend === 'improving') return 0.5;
  if (trend === 'declining') return 0.2;

  return 0.4; // Neutral
}

/**
 * Reward Monitor - Tracks reward distribution and detects anomalies
 */
export class RewardMonitor {
  constructor(windowSize = 100) {
    this.rewardHistory = [];
    this.windowSize = windowSize;
    this.alertThresholds = {
      avgRewardHigh: 0.9,
      avgRewardLow: 0.2,
      actionDominanceThreshold: 0.8,
    };
  }

  /**
   * Record a reward and check for anomalies
   */
  recordReward(reward, action, outcome = {}) {
    this.rewardHistory.push({
      reward,
      action,
      outcome,
      ts: Date.now(),
    });

    // Trim to window size
    if (this.rewardHistory.length > this.windowSize) {
      this.rewardHistory.shift();
    }

    // Check for anomalies
    this.checkAnomalies();
  }

  /**
   * Check for reward formula dysfunction
   */
  checkAnomalies() {
    if (this.rewardHistory.length < 10) return; // Need minimum samples

    // Check average reward
    const avgReward = this.rewardHistory.reduce((s, r) => s + r.reward, 0) / this.rewardHistory.length;

    if (avgReward > this.alertThresholds.avgRewardHigh) {
      logger.warn({
        avgReward,
        threshold: this.alertThresholds.avgRewardHigh,
        windowSize: this.rewardHistory.length,
      }, 'REWARD ANOMALY: Average reward too high - formula may be miscalibrated');
    }

    if (avgReward < this.alertThresholds.avgRewardLow) {
      logger.warn({
        avgReward,
        threshold: this.alertThresholds.avgRewardLow,
        windowSize: this.rewardHistory.length,
      }, 'REWARD ANOMALY: Average reward too low - formula may be miscalibrated');
    }

    // Check for action imbalance
    const actionCounts = {};
    this.rewardHistory.forEach(r => {
      actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
    });

    const total = this.rewardHistory.length;
    for (const [action, count] of Object.entries(actionCounts)) {
      const ratio = count / total;
      if (ratio > this.alertThresholds.actionDominanceThreshold) {
        logger.warn({
          dominantAction: action,
          ratio,
          threshold: this.alertThresholds.actionDominanceThreshold,
        }, 'ACTION IMBALANCE: One action dominates - bandit may be stuck');
      }
    }
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics() {
    if (this.rewardHistory.length === 0) {
      return {
        windowSize: 0,
        avgReward: null,
        byAction: {},
      };
    }

    const avgReward = this.rewardHistory.reduce((s, r) => s + r.reward, 0) / this.rewardHistory.length;

    const byAction = {};
    for (const action of ACTIONS) {
      const actionHistory = this.rewardHistory.filter(r => r.action === action);
      if (actionHistory.length > 0) {
        byAction[action] = {
          count: actionHistory.length,
          avgReward: actionHistory.reduce((s, r) => s + r.reward, 0) / actionHistory.length,
          ratio: actionHistory.length / this.rewardHistory.length,
        };
      }
    }

    return {
      windowSize: this.rewardHistory.length,
      avgReward,
      byAction,
      weights: REWARD_WEIGHTS,
    };
  }

  /**
   * Get recent reward history for debugging
   */
  getRecentHistory(limit = 10) {
    return this.rewardHistory.slice(-limit);
  }
}

// Singleton monitor instance
export const rewardMonitor = new RewardMonitor();

/**
 * Compute reward with logging and monitoring
 */
export function computeRewardWithMonitoring(components, action, metadata = {}) {
  const result = computeReward(components);

  // Log every reward computation for offline analysis
  logger.info({
    type: 'reward_computed',
    action,
    components: result.components,
    weights: result.weights,
    reward: result.reward,
    normalized: result.normalized,
    metadata,
  }, 'Reward computed');

  // Record in monitor
  if (result.complete) {
    rewardMonitor.recordReward(result.reward, action, {
      components: result.components,
      ...metadata,
    });
  }

  return result;
}
