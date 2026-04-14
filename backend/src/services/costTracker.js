/**
 * Cost Tracker Service
 * Tracks estimated API costs per user per day
 * @module services/costTracker
 */

import { logger } from '../utils/logger.js';

/**
 * Daily budget limit from environment variable (in USD)
 */
const DAILY_BUDGET_USD = parseFloat(process.env.DAILY_BUDGET_USD || '2.00');

/**
 * Cost per 1M tokens for each model
 * Format: { input: dollars, output: dollars }
 */
const MODEL_COSTS = {
  // Anthropic models
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20241022': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  'claude-haiku-4-5-20241022': { input: 0.25, output: 1.25 },
  // Fallback for unknown models
  'default': { input: 3.00, output: 15.00 },
};

/**
 * Fixed costs for other services
 */
const SERVICE_COSTS = {
  // Azure image generation (per image)
  'gpt-image-1.5': 0.04,
  'gpt-image': 0.04,
  // Azure TTS (per character)
  'tts': 0.000015,
  'tts-1': 0.000015,
};

/**
 * In-memory storage for daily usage
 * Map<userId, { date: string, cost: number, breakdown: {} }>
 */
const dailyUsage = new Map();

/**
 * Budget exceeded error class
 */
export class BudgetExceededError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} currentCost - Current daily cost
   * @param {number} budget - Daily budget limit
   */
  constructor(message, currentCost, budget) {
    super(message);
    this.name = 'BudgetExceededError';
    this.currentCost = currentCost;
    this.budget = budget;
  }
}

/**
 * Get current UTC date string
 * @returns {string} Date in YYYY-MM-DD format
 */
function getCurrentDateUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get or create daily usage record for a user
 * @param {string} userId - User ID
 * @returns {Object} Usage record
 */
function getUserDailyUsage(userId) {
  const today = getCurrentDateUTC();
  const existing = dailyUsage.get(userId);

  if (existing && existing.date === today) {
    return existing;
  }

  // Create new record for today
  const newRecord = {
    date: today,
    cost: 0,
    breakdown: {
      chat: 0,
      assets: 0,
      tts: 0,
      images: 0,
    },
    requests: {
      chat: 0,
      assets: 0,
      tts: 0,
      images: 0,
    },
    tokens: {
      input: 0,
      output: 0,
    },
  };

  dailyUsage.set(userId, newRecord);
  return newRecord;
}

/**
 * Estimate cost for a Claude API call
 * @param {string} model - Model name
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Estimated cost in USD
 */
export function estimateCost(model, inputTokens, outputTokens) {
  const modelKey = Object.keys(MODEL_COSTS).find(key => model.includes(key)) || 'default';
  const costs = MODEL_COSTS[modelKey];

  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;

  return inputCost + outputCost;
}

/**
 * Estimate cost for image generation
 * @param {number} count - Number of images
 * @returns {number} Estimated cost in USD
 */
export function estimateImageCost(count = 1) {
  return count * SERVICE_COSTS['gpt-image-1.5'];
}

/**
 * Estimate cost for TTS
 * @param {number} characterCount - Number of characters
 * @returns {number} Estimated cost in USD
 */
export function estimateTTSCost(characterCount) {
  return characterCount * SERVICE_COSTS['tts'];
}

/**
 * Check if user has exceeded daily budget
 * @param {string} userId - User ID
 * @throws {BudgetExceededError} If budget exceeded
 * @returns {Promise<void>}
 */
export async function checkBudget(userId) {
  if (!userId) {
    return; // Skip budget check for anonymous users
  }

  const usage = getUserDailyUsage(userId);

  if (usage.cost >= DAILY_BUDGET_USD) {
    throw new BudgetExceededError(
      `Daily budget of $${DAILY_BUDGET_USD.toFixed(2)} exceeded. Current usage: $${usage.cost.toFixed(4)}`,
      usage.cost,
      DAILY_BUDGET_USD
    );
  }
}

/**
 * Record API usage for a user
 * @param {string} userId - User ID
 * @param {string} model - Model used
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @param {string} category - Usage category (chat, assets, etc.)
 * @returns {Promise<{cost: number, dailyTotal: number, remaining: number}>}
 */
export async function recordUsage(userId, model, inputTokens, outputTokens, category = 'chat') {
  if (!userId) {
    return { cost: 0, dailyTotal: 0, remaining: DAILY_BUDGET_USD };
  }

  const cost = estimateCost(model, inputTokens, outputTokens);
  const usage = getUserDailyUsage(userId);

  usage.cost += cost;
  usage.tokens.input += inputTokens;
  usage.tokens.output += outputTokens;

  if (usage.breakdown[category] !== undefined) {
    usage.breakdown[category] += cost;
    usage.requests[category] = (usage.requests[category] || 0) + 1;
  }

  logger.debug(`Cost recorded for ${userId}: $${cost.toFixed(6)} (${model}, ${inputTokens}/${outputTokens} tokens)`);

  return {
    cost,
    dailyTotal: usage.cost,
    remaining: Math.max(0, DAILY_BUDGET_USD - usage.cost),
  };
}

/**
 * Record image generation usage
 * @param {string} userId - User ID
 * @param {number} imageCount - Number of images generated
 * @returns {Promise<{cost: number, dailyTotal: number, remaining: number}>}
 */
export async function recordImageUsage(userId, imageCount = 1) {
  if (!userId) {
    return { cost: 0, dailyTotal: 0, remaining: DAILY_BUDGET_USD };
  }

  const cost = estimateImageCost(imageCount);
  const usage = getUserDailyUsage(userId);

  usage.cost += cost;
  usage.breakdown.images += cost;
  usage.requests.images = (usage.requests.images || 0) + 1;

  logger.debug(`Image cost recorded for ${userId}: $${cost.toFixed(6)} (${imageCount} images)`);

  return {
    cost,
    dailyTotal: usage.cost,
    remaining: Math.max(0, DAILY_BUDGET_USD - usage.cost),
  };
}

/**
 * Record TTS usage
 * @param {string} userId - User ID
 * @param {number} characterCount - Number of characters
 * @returns {Promise<{cost: number, dailyTotal: number, remaining: number}>}
 */
export async function recordTTSUsage(userId, characterCount) {
  if (!userId) {
    return { cost: 0, dailyTotal: 0, remaining: DAILY_BUDGET_USD };
  }

  const cost = estimateTTSCost(characterCount);
  const usage = getUserDailyUsage(userId);

  usage.cost += cost;
  usage.breakdown.tts += cost;
  usage.requests.tts = (usage.requests.tts || 0) + 1;

  logger.debug(`TTS cost recorded for ${userId}: $${cost.toFixed(6)} (${characterCount} chars)`);

  return {
    cost,
    dailyTotal: usage.cost,
    remaining: Math.max(0, DAILY_BUDGET_USD - usage.cost),
  };
}

/**
 * Get usage statistics for a user
 * @param {string} userId - User ID
 * @returns {Object} Usage statistics
 */
export function getUsageStats(userId) {
  const usage = getUserDailyUsage(userId);

  return {
    date: usage.date,
    totalCost: parseFloat(usage.cost.toFixed(6)),
    budget: DAILY_BUDGET_USD,
    remaining: parseFloat(Math.max(0, DAILY_BUDGET_USD - usage.cost).toFixed(6)),
    percentUsed: parseFloat(((usage.cost / DAILY_BUDGET_USD) * 100).toFixed(2)),
    breakdown: {
      chat: parseFloat(usage.breakdown.chat.toFixed(6)),
      assets: parseFloat(usage.breakdown.assets.toFixed(6)),
      tts: parseFloat(usage.breakdown.tts.toFixed(6)),
      images: parseFloat(usage.breakdown.images.toFixed(6)),
    },
    requests: usage.requests,
    tokens: usage.tokens,
  };
}

/**
 * Reset daily usage at midnight UTC
 * Called by setInterval in server startup
 */
export function resetDailyUsage() {
  const today = getCurrentDateUTC();

  for (const [userId, usage] of dailyUsage.entries()) {
    if (usage.date !== today) {
      // Log previous day's usage before clearing
      logger.info(`Daily usage for ${userId.slice(0, 8)}: $${usage.cost.toFixed(4)}`);
      dailyUsage.delete(userId);
    }
  }
}

/**
 * Schedule daily reset at midnight UTC
 */
export function scheduleDailyReset() {
  // Check every minute for day change
  setInterval(() => {
    resetDailyUsage();
  }, 60 * 1000);

  // Also run immediately to clean up stale records
  resetDailyUsage();

  logger.info('Daily usage reset scheduler started');
}

/**
 * Get all users' usage (for admin purposes)
 * @returns {Array} All usage records
 */
export function getAllUsage() {
  const result = [];

  for (const [userId, usage] of dailyUsage.entries()) {
    result.push({
      userId: userId.slice(0, 8) + '...',
      ...getUsageStats(userId),
    });
  }

  return result;
}

export default {
  estimateCost,
  estimateImageCost,
  estimateTTSCost,
  checkBudget,
  recordUsage,
  recordImageUsage,
  recordTTSUsage,
  getUsageStats,
  resetDailyUsage,
  scheduleDailyReset,
  getAllUsage,
  BudgetExceededError,
  DAILY_BUDGET_USD,
};
