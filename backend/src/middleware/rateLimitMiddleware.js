/**
 * Rate Limit Middleware
 * Express middleware for per-user rate limiting
 * @module middleware/rateLimitMiddleware
 */

import { consumeLimitWithGlobal, RateLimitError } from '../services/rateLimiter.js';
import { checkBudget, BudgetExceededError } from '../services/costTracker.js';
import { logger } from '../utils/logger.js';

/**
 * Create rate limit middleware for a specific limit type
 * @param {string} limitType - Type of limit (chat, asset, tts, plan, learningContent)
 * @returns {Function} Express middleware function
 */
function createRateLimitMiddleware(limitType) {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return async function rateLimitMiddleware(req, res, next) {
    // Get user ID from auth middleware or request body
    const userId = req.user?.userId || req.body?.userId || 'anonymous';

    try {
      // Check rate limit
      await consumeLimitWithGlobal(limitType, userId);

      // Check budget (if authenticated)
      if (req.user?.userId) {
        await checkBudget(req.user.userId);
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.set('Retry-After', String(error.retryAfter));
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: error.message,
          retryAfter: error.retryAfter,
          traceId: req.traceId,
        });
      }

      if (error instanceof BudgetExceededError) {
        return res.status(429).json({
          error: 'Daily budget exceeded',
          message: error.message,
          currentCost: error.currentCost,
          budget: error.budget,
          traceId: req.traceId,
        });
      }

      logger.error('Rate limit middleware error:', error.message);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to check rate limits',
        traceId: req.traceId,
      });
    }
  };
}

/**
 * Chat endpoint rate limiter
 * 10 requests/min + 30 global requests/min
 */
export const rateLimitChat = createRateLimitMiddleware('chat');

/**
 * Asset generation rate limiter
 * 5 requests/min + 30 global requests/min
 */
export const rateLimitAssets = createRateLimitMiddleware('asset');

/**
 * TTS rate limiter
 * 20 requests/min + 30 global requests/min
 */
export const rateLimitTts = createRateLimitMiddleware('tts');

/**
 * Plan generation rate limiter
 * 3 requests/min + 30 global requests/min
 */
export const rateLimitPlan = createRateLimitMiddleware('plan');

/**
 * Learning content rate limiter
 * 5 requests/min + 30 global requests/min
 */
export const rateLimitLearningContent = createRateLimitMiddleware('learningContent');

/**
 * Generic rate limiter that only checks global limit
 * For endpoints that don't need specific limits
 */
export async function rateLimitGeneric(req, res, next) {
  const userId = req.user?.userId || req.body?.userId || 'anonymous';

  try {
    await consumeLimitWithGlobal('global', userId);
    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.set('Retry-After', String(error.retryAfter));
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: error.message,
        retryAfter: error.retryAfter,
        traceId: req.traceId,
      });
    }

    logger.error('Rate limit middleware error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check rate limits',
      traceId: req.traceId,
    });
  }
}

export default {
  rateLimitChat,
  rateLimitAssets,
  rateLimitTts,
  rateLimitPlan,
  rateLimitLearningContent,
  rateLimitGeneric,
};
