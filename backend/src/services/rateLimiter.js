/**
 * Rate Limiter Service
 * Per-user rate limiting using rate-limiter-flexible
 * @module services/rateLimiter
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';

/**
 * Rate limit configuration from environment variables
 */
const LIMITS = {
  chat: parseInt(process.env.RATE_LIMIT_CHAT || '10', 10),         // 10 requests/min
  asset: parseInt(process.env.RATE_LIMIT_ASSET || '5', 10),        // 5 requests/min
  tts: parseInt(process.env.RATE_LIMIT_TTS || '20', 10),           // 20 requests/min
  plan: parseInt(process.env.RATE_LIMIT_PLAN || '3', 10),          // 3 requests/min
  global: parseInt(process.env.RATE_LIMIT_GLOBAL || '60', 10),     // 60 requests/min total
  learningContent: parseInt(process.env.RATE_LIMIT_LEARNING || '5', 10), // 5 requests/min
  simulation: parseInt(process.env.RATE_LIMIT_SIMULATION || '30', 10), // 30 requests/min for simulations
};

/**
 * Rate limiter error class
 */
export class RateLimitError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds until limit resets
   */
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Chat endpoint rate limiter
 * 10 requests per minute per user
 */
const chatLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_chat',
  points: LIMITS.chat,
  duration: 60, // 1 minute
});

/**
 * Asset generation rate limiter
 * 5 requests per minute per user
 */
const assetLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_asset',
  points: LIMITS.asset,
  duration: 60,
});

/**
 * TTS rate limiter
 * 20 requests per minute per user
 */
const ttsLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_tts',
  points: LIMITS.tts,
  duration: 60,
});

/**
 * Plan generation rate limiter
 * 3 requests per minute per user
 */
const planLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_plan',
  points: LIMITS.plan,
  duration: 60,
});

/**
 * Learning content rate limiter
 * 5 requests per minute per user
 */
const learningContentLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_learning',
  points: LIMITS.learningContent,
  duration: 60,
});

/**
 * Simulation rate limiter
 * 30 requests per minute per user (more permissive for interactive simulations)
 */
const simulationLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_simulation',
  points: LIMITS.simulation,
  duration: 60,
});

/**
 * Global rate limiter
 * 60 requests per minute per user across all endpoints
 */
const globalLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_global',
  points: LIMITS.global,
  duration: 60,
});

/**
 * Map of limit types to their limiters
 */
const limiters = {
  chat: chatLimiter,
  asset: assetLimiter,
  tts: ttsLimiter,
  plan: planLimiter,
  learningContent: learningContentLimiter,
  simulation: simulationLimiter,
  global: globalLimiter,
};

/**
 * Consume a rate limit point for a specific limit type and user
 * @param {string} limitType - Type of limit (chat, asset, tts, plan, learningContent, global)
 * @param {string} userId - User ID to rate limit
 * @throws {RateLimitError} If rate limit exceeded
 * @returns {Promise<{remainingPoints: number, msBeforeNext: number}>}
 */
export async function consumeLimit(limitType, userId) {
  const limiter = limiters[limitType];

  if (!limiter) {
    throw new Error(`Unknown limit type: ${limitType}`);
  }

  if (!userId) {
    // Fallback to IP-based limiting if no userId
    userId = 'anonymous';
  }

  try {
    const result = await limiter.consume(userId, 1);

    return {
      remainingPoints: result.remainingPoints,
      msBeforeNext: result.msBeforeNext,
    };
  } catch (rateLimiterRes) {
    // Rate limit exceeded
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);

    logger.warn(`Rate limit exceeded for ${limitType}:${userId}, retry after ${retryAfter}s`);

    throw new RateLimitError(
      `Rate limit exceeded for ${limitType}. Try again in ${retryAfter} seconds.`,
      retryAfter
    );
  }
}

/**
 * Consume both specific and global rate limits
 * @param {string} limitType - Type of limit (chat, asset, tts, plan, learningContent)
 * @param {string} userId - User ID to rate limit
 * @throws {RateLimitError} If either rate limit exceeded
 * @returns {Promise<void>}
 */
export async function consumeLimitWithGlobal(limitType, userId) {
  // Check global limit first
  await consumeLimit('global', userId);

  // Then check specific limit
  await consumeLimit(limitType, userId);
}

/**
 * Get current rate limit status for a user
 * @param {string} limitType - Type of limit
 * @param {string} userId - User ID
 * @returns {Promise<{consumed: number, remaining: number, resetIn: number}>}
 */
export async function getLimitStatus(limitType, userId) {
  const limiter = limiters[limitType];

  if (!limiter) {
    throw new Error(`Unknown limit type: ${limitType}`);
  }

  try {
    const result = await limiter.get(userId);

    if (!result) {
      // No consumption yet
      return {
        consumed: 0,
        remaining: LIMITS[limitType],
        resetIn: 0,
      };
    }

    return {
      consumed: LIMITS[limitType] - result.remainingPoints,
      remaining: result.remainingPoints,
      resetIn: Math.ceil(result.msBeforeNext / 1000),
    };
  } catch (error) {
    logger.error('Error getting limit status:', error.message);
    return {
      consumed: 0,
      remaining: LIMITS[limitType],
      resetIn: 0,
    };
  }
}

/**
 * Get all rate limit statuses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} All limit statuses
 */
export async function getAllLimitStatuses(userId) {
  const statuses = {};

  for (const limitType of Object.keys(limiters)) {
    statuses[limitType] = await getLimitStatus(limitType, userId);
  }

  return statuses;
}

export default {
  consumeLimit,
  consumeLimitWithGlobal,
  getLimitStatus,
  getAllLimitStatuses,
  RateLimitError,
  LIMITS,
};
