/**
 * Model Versions Configuration
 * Centralized versioning for AI models and cache
 * @module config/modelVersions
 */

/**
 * AI model versions used across the application
 * Bumping a version automatically invalidates related cache entries
 */
export const MODEL_VERSIONS = {
  // Widget and visualization generation
  widgetGenerator: process.env.AZURE_OPENAI_DEPLOYMENT,

  // Learning plan generation
  planner: process.env.AZURE_OPENAI_DEPLOYMENT,

  // Fact checking
  factChecker: process.env.AZURE_OPENAI_DEPLOYMENT,

  // Image generation
  imageGenerator: 'gpt-image-1.5',

  // Chat and general responses
  chat: process.env.AZURE_OPENAI_DEPLOYMENT,

  // Learning content generation
  learningContent: process.env.AZURE_OPENAI_DEPLOYMENT,

  // Personalization analysis
  personalization: process.env.AZURE_OPENAI_DEPLOYMENT,
};

/**
 * Cache format version
 * Increment this to invalidate ALL cached assets when cache format changes
 */
export const CACHE_VERSION = '1.0';

/**
 * Cache TTL configurations (in days)
 */
export const CACHE_TTL = {
  // Widget cache TTL in days
  widgetTTLDays: 7,

  // Image cache TTL in days
  imageTTLDays: 30,

  // Learning plan cache TTL in days
  planTTLDays: 14,

  // Fact check cache TTL in days
  factCheckTTLDays: 1,

  // Profile cache TTL in seconds (not days)
  profileTTLSeconds: 300,

  // Learning content cache TTL in days
  learningContentTTLDays: 7,
};

/**
 * Convert days to milliseconds
 * @param {number} days - Number of days
 * @returns {number} Milliseconds
 */
export function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Get expiration date from now
 * @param {number} days - Number of days until expiration
 * @returns {Date} Expiration date
 */
export function getExpirationDate(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now;
}

/**
 * Get expiration ISO string for database
 * @param {number} days - Number of days until expiration
 * @returns {string} ISO date string
 */
export function getExpirationISO(days) {
  return getExpirationDate(days).toISOString();
}

/**
 * Check if a cache entry is expired
 * @param {string|Date} expiresAt - Expiration date
 * @returns {boolean} True if expired
 */
export function isExpired(expiresAt) {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return expiry < new Date();
}

/**
 * Get model version for a specific agent/feature
 * @param {string} feature - Feature name
 * @returns {string} Model version
 */
export function getModelVersion(feature) {
  return MODEL_VERSIONS[feature] || MODEL_VERSIONS.chat;
}

/**
 * Get TTL in days for a specific asset type
 * @param {string} assetType - Asset type
 * @returns {number} TTL in days
 */
export function getTTLDays(assetType) {
  switch (assetType?.toLowerCase()) {
    case 'widget':
      return CACHE_TTL.widgetTTLDays;
    case 'image':
      return CACHE_TTL.imageTTLDays;
    case 'plan':
      return CACHE_TTL.planTTLDays;
    case 'fact_check':
      return CACHE_TTL.factCheckTTLDays;
    case 'learning_content':
      return CACHE_TTL.learningContentTTLDays;
    default:
      return CACHE_TTL.widgetTTLDays;
  }
}

export default {
  MODEL_VERSIONS,
  CACHE_VERSION,
  CACHE_TTL,
  daysToMs,
  getExpirationDate,
  getExpirationISO,
  isExpired,
  getModelVersion,
  getTTLDays,
};
