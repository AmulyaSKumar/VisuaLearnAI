/**
 * Contextual Bandit Module
 * Production-ready adaptive decision engine using LinUCB
 *
 * Usage:
 *   import { bandit, getBanditDecision, recordReward } from './bandit/index.js';
 *
 *   // Initialize on startup
 *   await bandit.initialize();
 *
 *   // Get decision
 *   const decision = await getBanditDecision({
 *     userId: 'user-123',
 *     topic: 'binary search',
 *     profile: { learningStyle: 'visual' },
 *     metrics: { quizScore: 0.8 },
 *   });
 *
 *   // Record reward after interaction
 *   await recordReward(decision.id, {
 *     correctness: 0.9,
 *     engagement: 0.7,
 *     completion: 1.0,
 *     retention: 0.8,
 *   });
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Context
export {
  CONTEXT_VERSION,
  CONTEXT_DIM,
  COGNITIVE_STATES,
  ENGAGEMENT_LEVELS,
  deriveNumericContext,
  encodeCognitiveState,
  encodeEngagementLevel,
  encodeTopicStatus,
  encodePerformanceTrend,
  normalizeContextVector,
} from './context.js';

// Algorithm
export {
  ACTIONS,
  FAILSAFE_ACTION,
  COLD_START_CONFIG,
  LinUCBBandit,
  selectActionWithColdStart,
  selectActionSafe,
  serializeMatrix,
  deserializeMatrix,
  serializeVector,
  deserializeVector,
} from './algorithm.js';

// Reward
export {
  REWARD_WEIGHTS,
  computeReward,
  computeRewardWithMonitoring,
  deriveEngagementScore,
  deriveCompletionScore,
  deriveCorrectnessScore,
  deriveRetentionScore,
  RewardMonitor,
  rewardMonitor,
} from './reward.js';

// Enforcement
export {
  ACTION_REQUIREMENTS,
  validateChatResponse,
  validateLearningContent,
  enforceChatAction,
  enforceLearningAction,
  EnforcementMonitor,
  enforcementMonitor,
} from './enforcement.js';

// Logging
export {
  logDecisionCreated,
  logDecisionTrace,
  logRewardComputed,
  logParameterUpdate,
  logEnforcement,
  logDecisionResolved,
  logEvaluationMetrics,
  logColdStart,
  logFailsafe,
  logBanditInitialized,
  createDecisionLogger,
} from './logger.js';

// Evaluation
export {
  getEvaluationMode,
  shouldUseBaseline,
  getBaselineDecision,
  EvaluationMetrics,
  evaluationMetrics,
  logEvaluationMetrics as logEvalMetrics,
  queryEvaluationData,
} from './evaluation.js';

// Store
export {
  BanditStore,
  banditStore,
  createBanditStore,
  SCHEMA_SQL,
} from './store.js';

// Import for internal use
import { LinUCBBandit, ACTIONS, FAILSAFE_ACTION, selectActionSafe } from './algorithm.js';
import { deriveNumericContext, CONTEXT_VERSION } from './context.js';
import {
  computeRewardWithMonitoring,
  deriveEngagementScore,
  deriveCompletionScore,
  deriveCorrectnessScore,
  deriveRetentionScore,
} from './reward.js';
import { enforceChatAction, enforceLearningAction, enforcementMonitor } from './enforcement.js';
import {
  logDecisionCreated,
  logDecisionTrace,
  logRewardComputed,
  logDecisionResolved,
  logBanditInitialized,
  logFailsafe,
  logColdStart,
} from './logger.js';
import { shouldUseBaseline, getBaselineDecision, evaluationMetrics } from './evaluation.js';
import { banditStore } from './store.js';

/**
 * Main Bandit System
 */
class BanditSystem {
  constructor() {
    this.linucb = new LinUCBBandit(ACTIONS);
    this.store = banditStore;
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the bandit system
   * Safe to call multiple times - will only initialize once
   */
  async initialize() {
    if (this.initialized) {
      return this;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      await this.linucb.initialize(this.store);
      this.initialized = true;

      logBanditInitialized({
        actions: ACTIONS,
        dimension: this.linucb.d,
        alpha: this.linucb.alpha,
        version: CONTEXT_VERSION,
      });

      logger.info('Bandit system initialized successfully');
      return this;
    } catch (error) {
      logger.error({ error }, 'Bandit initialization failed');
      throw error;
    }
  }

  /**
   * Check if system is ready
   */
  isReady() {
    return this.initialized && this.linucb.initialized;
  }

  /**
   * Get LinUCB statistics
   */
  getStats() {
    return this.linucb.getStats();
  }
}

// Singleton bandit system
export const bandit = new BanditSystem();

/**
 * Generate unique decision ID
 */
function generateDecisionId() {
  return crypto.randomUUID();
}

/**
 * Get bandit decision for a learning interaction
 *
 * @param {Object} params - Decision parameters
 * @param {string} params.userId - User ID
 * @param {string} params.topic - Topic being learned
 * @param {Object} params.profile - User profile data
 * @param {Object} params.adaptiveContext - Cognitive state info
 * @param {Object} params.metrics - Performance metrics
 * @param {string} params.conversationId - Conversation ID (optional)
 * @returns {Object} Decision envelope with selectedAction, id, context, etc.
 */
export async function getBanditDecision({
  userId,
  topic,
  profile = {},
  adaptiveContext = {},
  metrics = {},
  conversationId = null,
  behavior = null,
  topicHistory = null,
}) {
  // Ensure initialized
  if (!bandit.isReady()) {
    await bandit.initialize();
  }

  const decisionId = generateDecisionId();

  // Check for A/B testing baseline assignment
  if (shouldUseBaseline(userId)) {
    const baselineDecision = getBaselineDecision({ userId, topic });

    const decision = {
      id: decisionId,
      userId,
      conversationId,
      topicKey: topic,
      topicLabel: topic,
      selectedAction: baselineDecision.selectedAction,
      decisionSource: 'baseline',
      scores: {},
      coldStart: false,
      isBaseline: true,
      shadow: false,
      context: null,
      createdAt: new Date().toISOString(),
    };

    // Persist decision
    await bandit.store.saveDecision(decision);
    logDecisionCreated(decision);

    // Record for baseline metrics
    evaluationMetrics.recordBaselineResult({
      action: decision.selectedAction,
      userId,
      topic,
    });

    return decision;
  }

  // Derive numeric context
  const context = deriveNumericContext({
    profile,
    metrics,
    adaptiveContext,
    topicHistory,
    topicLabel: topic,
    behavior,
  });

  // Select action using LinUCB with cold start handling
  const linucbDecision = selectActionSafe(bandit.linucb, context.vector);

  // Log cold start if applicable
  if (linucbDecision.coldStart) {
    logColdStart(userId, linucbDecision.totalSamples, true);
  }

  const decision = {
    id: decisionId,
    userId,
    conversationId,
    topicKey: topic,
    topicLabel: topic,
    selectedAction: linucbDecision.selectedAction,
    decisionSource: linucbDecision.source,
    scores: linucbDecision.scores,
    coldStart: linucbDecision.coldStart || false,
    totalSamples: linucbDecision.totalSamples,
    isBaseline: false,
    shadow: false,
    context,
    createdAt: new Date().toISOString(),
  };

  // Persist decision
  await bandit.store.saveDecision(decision);

  // Log for traceability
  logDecisionCreated(decision);
  logDecisionTrace(decision);

  // Record for bandit metrics
  evaluationMetrics.recordBanditResult({
    action: decision.selectedAction,
    userId,
    topic,
    source: decision.decisionSource,
  });

  return decision;
}

/**
 * Record reward for a decision and update LinUCB parameters
 *
 * @param {string} decisionId - Decision ID to resolve
 * @param {Object} components - Reward components
 * @param {number} components.correctness - Quiz/validation accuracy [0, 1]
 * @param {number} components.engagement - Interaction depth [0, 1]
 * @param {number} components.completion - Task completion [0, 1]
 * @param {number} components.retention - Repeated success [0, 1]
 * @param {Object} metadata - Additional metadata for logging
 */
export async function recordReward(decisionId, components, metadata = {}) {
  // Ensure initialized
  if (!bandit.isReady()) {
    await bandit.initialize();
  }

  // Get the original decision
  const decision = await bandit.store.getDecision(decisionId);

  if (!decision) {
    logger.warn({ decisionId }, 'Cannot record reward - decision not found');
    return null;
  }

  // Compute reward
  const reward = computeRewardWithMonitoring(
    components,
    decision.selected_action || decision.selectedAction,
    {
      decisionId,
      userId: decision.user_id || decision.userId,
      topic: decision.topic_key || decision.topicKey,
      ...metadata,
    }
  );

  // Log reward computation
  logRewardComputed(decision, reward);

  // Update LinUCB parameters (only for non-baseline decisions)
  const isBaseline = decision.is_baseline || decision.isBaseline;
  if (!isBaseline && reward.complete) {
    const contextVector = decision.context_vector || decision.context?.vector;

    if (contextVector) {
      await bandit.linucb.update(
        decision.selected_action || decision.selectedAction,
        contextVector,
        reward.reward,
        bandit.store
      );
    }
  }

  // Resolve decision in store
  await bandit.store.resolveDecision(decisionId, reward);

  // Log resolution
  logDecisionResolved(decision, reward);

  // Update evaluation metrics
  if (isBaseline) {
    evaluationMetrics.recordBaselineResult({
      action: decision.selected_action || decision.selectedAction,
      reward: reward.reward,
      engagement: components.engagement,
      success: reward.reward > 0.5,
    });
  } else {
    evaluationMetrics.recordBanditResult({
      action: decision.selected_action || decision.selectedAction,
      reward: reward.reward,
      engagement: components.engagement,
      success: reward.reward > 0.5,
    });
  }

  return reward;
}

/**
 * Record reward from interaction data (derives components automatically)
 *
 * @param {string} decisionId - Decision ID
 * @param {string} interactionType - Type of interaction (quiz_answer, widget_analytics, etc.)
 * @param {Object} data - Interaction data
 * @param {Object} topicHistory - Topic history for retention
 */
export async function recordRewardFromInteraction(decisionId, interactionType, data = {}, topicHistory = null) {
  const correctness = deriveCorrectnessScore(data);
  const engagement = deriveEngagementScore(interactionType, data);
  const completion = deriveCompletionScore(interactionType, data);
  const retention = deriveRetentionScore(topicHistory, correctness);

  return recordReward(decisionId, {
    correctness,
    engagement,
    completion,
    retention,
  }, {
    interactionType,
    rawData: data,
  });
}

/**
 * Enforce action on chat response
 * Returns enforcement result and logs violations
 *
 * @param {string} decisionId - Decision ID for logging
 * @param {string} action - Selected action
 * @param {string} responseText - Full response text
 * @param {Array} toolCalls - Tool calls made
 * @returns {Object} { enforced: boolean, fallback?: string, violations?: string[] }
 */
export function enforceAction(decisionId, action, responseText, toolCalls = []) {
  const result = enforceChatAction(action, responseText, toolCalls);

  if (!result.enforced) {
    logFailsafe(`Enforcement failed for ${action}`, {
      decisionId,
      violations: result.violations,
      fallback: result.fallback,
    });
  }

  return result;
}

/**
 * Enforce action on learning content
 *
 * @param {string} decisionId - Decision ID for logging
 * @param {string} action - Selected action
 * @param {string} contentType - Type of content (learn, quiz, etc.)
 * @param {Object} content - Generated content
 * @returns {Object} { enforced: boolean, fallback?: string, violations?: string[] }
 */
export function enforceLearningContentAction(decisionId, action, contentType, content) {
  const result = enforceLearningAction(action, contentType, content);

  if (!result.enforced) {
    logFailsafe(`Learning content enforcement failed for ${action}`, {
      decisionId,
      contentType,
      violations: result.violations,
      fallback: result.fallback,
    });
  }

  return result;
}

/**
 * Get action instructions for content generation
 * Use in system prompts to guide LLM output
 *
 * @param {string} action - Selected bandit action
 * @returns {string} Instructions for content generation
 */
export function getActionInstructions(action) {
  const instructions = {
    visual_widget: `
CRITICAL: For every key concept, include a visualization block.
Use charts, diagrams, or interactive elements.
DO NOT rely on text-only explanations.
Every major idea must have an accompanying visual representation.`,

    guided_steps: `
CRITICAL: Structure every explanation as numbered steps.
1. Start with the simplest prerequisite
2. Build up incrementally
3. Include checkpoints between steps
DO NOT dump information in paragraphs.
Use clear numbered or bulleted lists.`,

    quiz_check: `
CRITICAL: Include comprehension check questions throughout.
After every major concept, add a quick check question.
Questions should test understanding, not just recall.
Include at least one question mark in your response.`,

    text_explanation: `
CRITICAL: Keep explanations concise and text-focused.
DO NOT add unnecessary visualizations or widgets.
Focus on clarity and examples in prose.
Keep response under 2000 characters where possible.`,
  };

  return instructions[action] || '';
}

/**
 * Get system metrics for monitoring dashboard
 */
export function getBanditMetrics() {
  return {
    linucb: bandit.getStats(),
    enforcement: enforcementMonitor.getMetrics(),
    evaluation: evaluationMetrics.getComparison(),
  };
}

/**
 * Get time series data for dashboard visualization
 */
export function getBanditTimeSeries(bucketMs = 60000) {
  return evaluationMetrics.getTimeSeries(bucketMs);
}

// Default export for convenience
export default {
  bandit,
  getBanditDecision,
  recordReward,
  recordRewardFromInteraction,
  enforceAction,
  enforceLearningContentAction,
  getActionInstructions,
  getBanditMetrics,
  getBanditTimeSeries,
};
