/**
 * Redis Cache Service
 * Uses Upstash Redis for serverless caching
 * Falls back to in-memory cache if Redis unavailable
 * @module services/cache
 */

import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger.js';

/**
 * In-memory fallback cache
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key, value, ttlSeconds) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const item = {
      value,
      expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
    };

    this.store.set(key, item);

    // Set expiry timer
    if (ttlSeconds) {
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.timers.delete(key);
      }, ttlSeconds * 1000);
      this.timers.set(key, timer);
    }

    return 'OK';
  }

  async del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key) {
    const item = this.store.get(key);
    if (!item) return 0;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async ttl(key) {
    const item = this.store.get(key);
    if (!item || !item.expiresAt) return -1;

    const remaining = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key) {
    const current = await this.get(key);
    const newValue = (parseInt(current) || 0) + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key, seconds) {
    const item = this.store.get(key);
    if (!item) return 0;

    item.expiresAt = Date.now() + (seconds * 1000);

    // Update timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);

    return 1;
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches = [];

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        const item = this.store.get(key);
        if (!item.expiresAt || Date.now() <= item.expiresAt) {
          matches.push(key);
        }
      }
    }

    return matches;
  }

  async mget(...keys) {
    return Promise.all(keys.map(key => this.get(key)));
  }

  async mset(keyValues) {
    for (let i = 0; i < keyValues.length; i += 2) {
      await this.set(keyValues[i], keyValues[i + 1]);
    }
    return 'OK';
  }

  async hset(key, field, value) {
    let hash = this.store.get(key)?.value || {};
    hash[field] = value;
    await this.set(key, hash);
    return 1;
  }

  async hget(key, field) {
    const hash = await this.get(key);
    return hash?.[field] || null;
  }

  async hgetall(key) {
    return await this.get(key) || {};
  }

  async hdel(key, field) {
    const hash = await this.get(key);
    if (!hash || !hash[field]) return 0;
    delete hash[field];
    await this.set(key, hash);
    return 1;
  }

  async flushdb() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.store.clear();
    this.timers.clear();
    return 'OK';
  }

  get size() {
    return this.store.size;
  }
}

/**
 * Cache wrapper with consistent API
 */
class CacheService {
  constructor() {
    this.redis = null;
    this.fallback = new MemoryCache();
    this.isRedisAvailable = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;

    this._initRedis();
  }

  /**
   * Initialize Redis connection
   */
  _initRedis() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      logger.warn('Upstash Redis credentials not configured, using in-memory cache');
      return;
    }

    try {
      this.redis = new Redis({
        url,
        token,
        automaticDeserialization: true,
      });

      // Test connection
      this._testConnection();
    } catch (err) {
      logger.error({ error: err }, 'Failed to initialize Redis client');
      this.isRedisAvailable = false;
    }
  }

  /**
   * Test Redis connection
   */
  async _testConnection() {
    try {
      await this.redis.ping();
      this.isRedisAvailable = true;
      this.reconnectAttempts = 0;
      logger.info('Connected to Upstash Redis');
    } catch (err) {
      logger.warn({ error: err }, 'Redis connection test failed, using fallback');
      this.isRedisAvailable = false;
      this._scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('Max Redis reconnect attempts reached, staying with fallback');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectAttempts++;

    setTimeout(() => {
      logger.info({ attempt: this.reconnectAttempts }, 'Attempting Redis reconnection');
      this._testConnection();
    }, delay);
  }

  /**
   * Get active client
   */
  _getClient() {
    return this.isRedisAvailable ? this.redis : this.fallback;
  }

  /**
   * Execute operation with fallback
   */
  async _exec(operation, ...args) {
    const client = this._getClient();

    try {
      return await client[operation](...args);
    } catch (err) {
      if (this.isRedisAvailable) {
        logger.error({ error: err, operation }, 'Redis operation failed, falling back');
        this.isRedisAvailable = false;
        this._scheduleReconnect();

        // Retry with fallback
        return await this.fallback[operation](...args);
      }
      throw err;
    }
  }

  /**
   * Get value by key
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      const value = await this._exec('get', key);
      return value;
    } catch (err) {
      logger.error({ error: err, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set value with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - TTL in seconds
   * @returns {Promise<string>} 'OK' on success
   */
  async set(key, value, ttlSeconds) {
    try {
      if (this.isRedisAvailable) {
        if (ttlSeconds) {
          return await this.redis.set(key, value, { ex: ttlSeconds });
        }
        return await this.redis.set(key, value);
      }
      return await this.fallback.set(key, value, ttlSeconds);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache set error');
      // Try fallback
      return await this.fallback.set(key, value, ttlSeconds);
    }
  }

  /**
   * Delete key
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(key) {
    try {
      return await this._exec('del', key);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache del error');
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<number>} 1 if exists, 0 otherwise
   */
  async exists(key) {
    try {
      return await this._exec('exists', key);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache exists error');
      return 0;
    }
  }

  /**
   * Get TTL for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key) {
    try {
      return await this._exec('ttl', key);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache ttl error');
      return -2;
    }
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @returns {Promise<number>} New value
   */
  async incr(key) {
    try {
      return await this._exec('incr', key);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache incr error');
      return 0;
    }
  }

  /**
   * Set expiry on key
   * @param {string} key - Cache key
   * @param {number} seconds - TTL in seconds
   * @returns {Promise<number>} 1 if set, 0 if key doesn't exist
   */
  async expire(key, seconds) {
    try {
      return await this._exec('expire', key, seconds);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache expire error');
      return 0;
    }
  }

  /**
   * Get keys matching pattern
   * @param {string} pattern - Glob pattern
   * @returns {Promise<string[]>} Matching keys
   */
  async keys(pattern) {
    try {
      return await this._exec('keys', pattern);
    } catch (err) {
      logger.error({ error: err, pattern }, 'Cache keys error');
      return [];
    }
  }

  /**
   * Get multiple values
   * @param {...string} keys - Cache keys
   * @returns {Promise<any[]>} Values
   */
  async mget(...keys) {
    try {
      return await this._exec('mget', ...keys);
    } catch (err) {
      logger.error({ error: err, keys }, 'Cache mget error');
      return keys.map(() => null);
    }
  }

  /**
   * Hash set
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @param {any} value - Field value
   */
  async hset(key, field, value) {
    try {
      return await this._exec('hset', key, field, value);
    } catch (err) {
      logger.error({ error: err, key, field }, 'Cache hset error');
      return 0;
    }
  }

  /**
   * Hash get
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<any>} Field value
   */
  async hget(key, field) {
    try {
      return await this._exec('hget', key, field);
    } catch (err) {
      logger.error({ error: err, key, field }, 'Cache hget error');
      return null;
    }
  }

  /**
   * Get all hash fields
   * @param {string} key - Hash key
   * @returns {Promise<Object>} All fields
   */
  async hgetall(key) {
    try {
      return await this._exec('hgetall', key);
    } catch (err) {
      logger.error({ error: err, key }, 'Cache hgetall error');
      return {};
    }
  }

  /**
   * Delete hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   */
  async hdel(key, field) {
    try {
      return await this._exec('hdel', key, field);
    } catch (err) {
      logger.error({ error: err, key, field }, 'Cache hdel error');
      return 0;
    }
  }

  /**
   * Get or set with factory function
   * @param {string} key - Cache key
   * @param {Function} factory - Async function to generate value if not cached
   * @param {number} ttlSeconds - TTL in seconds
   * @returns {Promise<any>} Cached or generated value
   */
  async getOrSet(key, factory, ttlSeconds) {
    try {
      const cached = await this.get(key);
      if (cached !== null) {
        return { value: cached, fromCache: true };
      }

      const value = await factory();
      await this.set(key, value, ttlSeconds);
      return { value, fromCache: false };
    } catch (err) {
      logger.error({ error: err, key }, 'Cache getOrSet error');
      // Try to get fresh value
      return { value: await factory(), fromCache: false };
    }
  }

  /**
   * Invalidate keys by pattern
   * @param {string} pattern - Glob pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      let deleted = 0;
      for (const key of keys) {
        deleted += await this.del(key);
      }

      logger.debug({ pattern, deleted }, 'Invalidated cache pattern');
      return deleted;
    } catch (err) {
      logger.error({ error: err, pattern }, 'Cache invalidatePattern error');
      return 0;
    }
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      isRedisAvailable: this.isRedisAvailable,
      fallbackSize: this.fallback.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Flush all cache (use with caution)
   */
  async flush() {
    try {
      await this.fallback.flushdb();
      if (this.isRedisAvailable) {
        await this.redis.flushdb();
      }
      logger.info('Cache flushed');
    } catch (err) {
      logger.error({ error: err }, 'Cache flush error');
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

export default cache;
