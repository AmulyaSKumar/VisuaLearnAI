/**
 * Simulation Cache
 * LRU caching for classification and simulation results
 */

/**
 * Simple LRU Cache implementation
 */
class LRUCache {
  constructor(options = {}) {
    this.max = options.max || 100;
    this.ttl = options.ttl || 1000 * 60 * 30; // 30 minutes default
    this.cache = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check TTL
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  /**
   * Set a value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] - Optional custom TTL for this item
   */
  set(key, value, ttl) {
    // Remove oldest items if at capacity
    while (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl || this.ttl)
    });
  }

  /**
   * Check if key exists in cache
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key from cache
   * @param {string} key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  stats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const [, item] of this.cache) {
      if (now > item.expiry) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      max: this.max,
      ttl: this.ttl
    };
  }
}

// Classification cache (for LLM results)
export const classificationCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 30 // 30 minutes
});

// Simulation cache (for generated IRs)
export const simulationCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 60 // 1 hour
});

/**
 * Generate cache key for classification
 * @param {string} query - User query
 * @returns {string}
 */
export function getClassificationCacheKey(query) {
  // Normalize query for better cache hits
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generate cache key for simulation
 * @param {string} generatorKey - Generator key
 * @param {object} inputs - User inputs
 * @returns {string}
 */
export function getSimulationCacheKey(generatorKey, inputs) {
  const inputStr = JSON.stringify(inputs, Object.keys(inputs).sort());
  return `${generatorKey}:${inputStr}`;
}

/**
 * Get classification from cache or execute and cache
 * @param {string} query - User query
 * @param {function} classifyFn - Classification function to call if cache miss
 * @returns {Promise<object>}
 */
export async function classifyWithCache(query, classifyFn) {
  const cacheKey = getClassificationCacheKey(query);

  // Check cache
  const cached = classificationCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Execute classification
  const result = await classifyFn(query);

  // Cache successful results
  if (result && result.simulatable !== undefined) {
    classificationCache.set(cacheKey, result);
  }

  return { ...result, cached: false };
}

/**
 * Get simulation from cache
 * @param {string} generatorKey
 * @param {object} inputs
 * @returns {object|undefined}
 */
export function getSimulationFromCache(generatorKey, inputs) {
  const cacheKey = getSimulationCacheKey(generatorKey, inputs);
  return simulationCache.get(cacheKey);
}

/**
 * Store simulation in cache
 * @param {string} generatorKey
 * @param {object} inputs
 * @param {object} ir - Simulation IR
 */
export function cacheSimulation(generatorKey, inputs, ir) {
  const cacheKey = getSimulationCacheKey(generatorKey, inputs);
  simulationCache.set(cacheKey, ir);
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  classificationCache.clear();
  simulationCache.clear();
}

/**
 * Get combined cache statistics
 * @returns {object}
 */
export function getCacheStats() {
  return {
    classification: classificationCache.stats(),
    simulation: simulationCache.stats()
  };
}

export default {
  classificationCache,
  simulationCache,
  getClassificationCacheKey,
  getSimulationCacheKey,
  classifyWithCache,
  getSimulationFromCache,
  cacheSimulation,
  clearAllCaches,
  getCacheStats,
  LRUCache
};
