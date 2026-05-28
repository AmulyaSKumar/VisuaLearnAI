import crypto from 'crypto';
import { cache } from '../services/cache.js';
import { LIMITS, normalizeTopic } from './schema.js';

const PREFIX = 'visual3d';

export function createCacheKey(topic, options = {}) {
  const normalized = normalizeTopic(topic) || String(topic || '').trim();
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      topic: normalized.toLowerCase(),
      version: options.version || '0.1.0',
    }))
    .digest('hex')
    .slice(0, 24);
  return `${PREFIX}:${hash}`;
}

export async function getCachedBlueprint(topic, options = {}) {
  const key = createCacheKey(topic, options);
  const value = await cache.get(key);
  return { key, value };
}

export async function setCachedBlueprint(topic, value, options = {}) {
  const key = createCacheKey(topic, options);
  await cache.set(key, value, options.ttlSeconds || LIMITS.cacheTtlSeconds);
  return key;
}

export function getVisual3dCacheStats() {
  return cache.getStats();
}
