/**
 * Bandit-Specific Logging Module
 * Provides structured logging for full traceability
 */

import { logger as baseLogger } from '../utils/logger.js';

/**
 * Log decision creation
 */
export function logDecisionCreated(decision) {
  baseLogger.info({
    type: 'bandit_decision_created',
    traceId: decision.id,
    timestamp: decision.createdAt,
    userId: decision.userId,
    conversationId: decision.conversationId,
    topic: {
      key: decision.topicKey,
      label: decision.topicLabel,
    },
    context: {
      vector: decision.context?.vector,
      key: decision.context?.contextKey,
      labels: decision.context?.labels,
    },
    action: {
      selected: decision.selectedAction,
      source: decision.decisionSource,
    },
    scores: decision.scores,
    coldStart: decision.coldStart,
    shadow: decision.shadow,
  }, `Bandit decision: ${decision.selectedAction}`);
}

/**
 * Log decision trace with full context
 */
export function logDecisionTrace(decision) {
  baseLogger.info({
    type: 'bandit_trace',
    traceId: decision.id,
    timestamp: Date.now(),
    context: {
      vector: decision.context?.vector,
      key: decision.context?.contextKey,
      labels: decision.context?.labels,
      version: decision.context?.version,
    },
    action: {
      selected: decision.selectedAction,
      source: decision.decisionSource,
      confidence: decision.confidenceLevel,
    },
    ucbScores: decision.scores,
    previousPerformance: decision.previousActionPerformance,
    coldStart: decision.coldStart,
    totalSamples: decision.totalSamples,
  }, 'Bandit decision trace');
}

/**
 * Log reward computation
 */
export function logRewardComputed(decision, reward) {
  baseLogger.info({
    type: 'bandit_reward_computed',
    traceId: decision.id,
    action: decision.selectedAction,
    reward: {
      final: reward.reward,
      normalized: reward.normalized,
      components: reward.components,
      weights: reward.weights,
    },
    context: {
      key: decision.context?.contextKey,
      vector: decision.context?.vector,
    },
  }, `Reward computed: ${reward.reward?.toFixed(3)}`);
}

/**
 * Log LinUCB parameter update
 */
export function logParameterUpdate(action, reward, updateCount) {
  baseLogger.info({
    type: 'bandit_param_update',
    action,
    reward,
    updateCount,
    timestamp: Date.now(),
  }, `LinUCB updated: ${action} (count: ${updateCount})`);
}

/**
 * Log enforcement result
 */
export function logEnforcement(decision, enforcement) {
  const level = enforcement.enforced ? 'info' : 'warn';

  baseLogger[level]({
    type: 'bandit_enforcement',
    traceId: decision.id,
    action: decision.selectedAction,
    enforced: enforcement.enforced,
    violations: enforcement.violations,
    fallback: enforcement.fallback,
  }, enforcement.enforced
    ? `Enforcement passed: ${decision.selectedAction}`
    : `Enforcement failed: ${decision.selectedAction} -> ${enforcement.fallback}`
  );
}

/**
 * Log decision resolution (reward applied)
 */
export function logDecisionResolved(decision, reward) {
  baseLogger.info({
    type: 'bandit_decision_resolved',
    traceId: decision.id,
    action: decision.selectedAction,
    reward: {
      final: reward.reward,
      normalized: reward.normalized,
      components: reward.components,
    },
    context: decision.context?.contextKey,
    resolvedAt: new Date().toISOString(),
    duration: decision.createdAt
      ? Date.now() - new Date(decision.createdAt).getTime()
      : null,
  }, `Decision resolved: ${decision.selectedAction} -> ${reward.reward?.toFixed(3)}`);
}

/**
 * Log evaluation metrics
 */
export function logEvaluationMetrics(metrics) {
  baseLogger.info({
    type: 'bandit_evaluation',
    timestamp: Date.now(),
    bandit: metrics.bandit,
    baseline: metrics.baseline,
    comparison: metrics.comparison,
  }, 'Bandit evaluation metrics');
}

/**
 * Log cold start detection
 */
export function logColdStart(userId, totalSamples, boostApplied) {
  baseLogger.info({
    type: 'bandit_cold_start',
    userId,
    totalSamples,
    boostApplied,
  }, `Cold start detected: samples=${totalSamples}`);
}

/**
 * Log failsafe activation
 */
export function logFailsafe(reason, error = null) {
  baseLogger.warn({
    type: 'bandit_failsafe',
    reason,
    error: error?.message,
    timestamp: Date.now(),
  }, `Bandit failsafe activated: ${reason}`);
}

/**
 * Log bandit initialization
 */
export function logBanditInitialized(config) {
  baseLogger.info({
    type: 'bandit_initialized',
    config: {
      actions: config.actions,
      dimension: config.dimension,
      alpha: config.alpha,
      version: config.version,
    },
    timestamp: Date.now(),
  }, 'Bandit system initialized');
}

/**
 * Create child logger with decision context
 */
export function createDecisionLogger(decisionId) {
  return baseLogger.child({
    banditDecisionId: decisionId,
  });
}

/**
 * Export base logger for general use
 */
export { baseLogger as logger };
