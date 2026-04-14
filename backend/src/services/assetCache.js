/**
 * Asset Cache Service
 * Handles caching of AI-generated assets with TTL and model versioning
 * @module services/assetCache
 */

import crypto from 'crypto';
import { supabase } from '../database/client.js';
import { logger } from './logger.js';
import {
  MODEL_VERSIONS,
  CACHE_VERSION,
  getExpirationISO,
  getTTLDays,
  isExpired,
  getModelVersion,
} from '../config/modelVersions.js';

/**
 * Generate cache key hash including model version
 * @param {string} prompt - The prompt used to generate the asset
 * @param {string} assetType - Type of asset (widget, image, plan, etc.)
 * @returns {string} SHA256 hash
 */
export function generateCacheKey(prompt, assetType = 'widget') {
  const modelVersion = getModelVersion(
    assetType === 'widget' ? 'widgetGenerator' :
    assetType === 'image' ? 'imageGenerator' :
    assetType === 'plan' ? 'planner' :
    assetType === 'fact_check' ? 'factChecker' : 'chat'
  );

  const keyInput = `${prompt}|${modelVersion}|${CACHE_VERSION}`;
  return crypto.createHash('sha256').update(keyInput).digest('hex');
}

/**
 * Get cached asset if valid (not expired and matching model version)
 * @param {string} promptHash - Cache key hash
 * @param {string} assetType - Asset type
 * @returns {Promise<Object|null>} Cached asset or null
 */
export async function getCachedAsset(promptHash, assetType = 'widget') {
  try {
    const modelVersion = getModelVersion(
      assetType === 'widget' ? 'widgetGenerator' :
      assetType === 'image' ? 'imageGenerator' :
      assetType === 'plan' ? 'planner' :
      assetType === 'fact_check' ? 'factChecker' : 'chat'
    );

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('asset_cache')
      .select('*')
      .eq('prompt_hash', promptHash)
      .eq('asset_type', assetType)
      .eq('model_version', modelVersion)
      .gt('expires_at', now)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No matching record found
        logger.debug({ promptHash, assetType }, 'Cache miss');
        return null;
      }
      throw error;
    }

    // Double-check expiration
    if (isExpired(data.expires_at)) {
      logger.debug({ promptHash, assetType }, 'Cache expired');
      return null;
    }

    logger.debug({ promptHash, assetType, modelVersion }, 'Cache hit');
    return data;
  } catch (err) {
    logger.error({ error: err, promptHash, assetType }, 'Error reading asset cache');
    return null;
  }
}

/**
 * Store asset in cache with TTL and model version
 * @param {Object} params - Cache parameters
 * @param {string} params.promptHash - Cache key hash
 * @param {string} params.assetType - Asset type
 * @param {string} params.content - Asset content
 * @param {string} params.prompt - Original prompt
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object|null>} Stored cache entry or null
 */
export async function setCachedAsset({
  promptHash,
  assetType = 'widget',
  content,
  prompt,
  metadata = {},
}) {
  try {
    const modelVersion = getModelVersion(
      assetType === 'widget' ? 'widgetGenerator' :
      assetType === 'image' ? 'imageGenerator' :
      assetType === 'plan' ? 'planner' :
      assetType === 'fact_check' ? 'factChecker' : 'chat'
    );

    const ttlDays = getTTLDays(assetType);
    const expiresAt = getExpirationISO(ttlDays);

    const cacheEntry = {
      prompt_hash: promptHash,
      asset_type: assetType,
      content,
      prompt,
      model_version: modelVersion,
      cache_version: CACHE_VERSION,
      expires_at: expiresAt,
      metadata: {
        ...metadata,
        ttlDays,
      },
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('asset_cache')
      .upsert(cacheEntry, {
        onConflict: 'prompt_hash,asset_type',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.debug({
      promptHash,
      assetType,
      modelVersion,
      expiresAt,
    }, 'Asset cached');

    return data;
  } catch (err) {
    logger.error({ error: err, promptHash, assetType }, 'Error writing asset cache');
    return null;
  }
}

/**
 * Delete cached asset
 * @param {string} promptHash - Cache key hash
 * @param {string} assetType - Asset type
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteCachedAsset(promptHash, assetType = 'widget') {
  try {
    const { error } = await supabase
      .from('asset_cache')
      .delete()
      .eq('prompt_hash', promptHash)
      .eq('asset_type', assetType);

    if (error) throw error;

    logger.debug({ promptHash, assetType }, 'Asset cache deleted');
    return true;
  } catch (err) {
    logger.error({ error: err, promptHash, assetType }, 'Error deleting asset cache');
    return false;
  }
}

/**
 * Invalidate cache by model version
 * @param {string} modelVersion - Model version to invalidate
 * @returns {Promise<number>} Number of deleted entries
 */
export async function invalidateByModelVersion(modelVersion) {
  try {
    const { data, error } = await supabase
      .from('asset_cache')
      .delete()
      .eq('model_version', modelVersion)
      .select('id');

    if (error) throw error;

    const count = data?.length || 0;
    logger.info({ modelVersion, deleted: count }, 'Cache invalidated by model version');
    return count;
  } catch (err) {
    logger.error({ error: err, modelVersion }, 'Error invalidating cache by model version');
    return 0;
  }
}

/**
 * Invalidate cache by asset type
 * @param {string} assetType - Asset type to invalidate
 * @returns {Promise<number>} Number of deleted entries
 */
export async function invalidateByAssetType(assetType) {
  try {
    const { data, error } = await supabase
      .from('asset_cache')
      .delete()
      .eq('asset_type', assetType)
      .select('id');

    if (error) throw error;

    const count = data?.length || 0;
    logger.info({ assetType, deleted: count }, 'Cache invalidated by asset type');
    return count;
  } catch (err) {
    logger.error({ error: err, assetType }, 'Error invalidating cache by asset type');
    return 0;
  }
}

/**
 * Purge expired cache entries
 * @returns {Promise<number>} Number of purged entries
 */
export async function purgeExpiredCache() {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('asset_cache')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) throw error;

    const count = data?.length || 0;
    logger.info({ purged: count }, 'Expired cache entries purged');
    return count;
  } catch (err) {
    logger.error({ error: err }, 'Error purging expired cache');
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  try {
    const now = new Date().toISOString();

    // Get total count
    const { count: totalCount } = await supabase
      .from('asset_cache')
      .select('*', { count: 'exact', head: true });

    // Get valid count
    const { count: validCount } = await supabase
      .from('asset_cache')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', now);

    // Get expired count
    const expiredCount = (totalCount || 0) - (validCount || 0);

    // Get breakdown by type
    const { data: byType } = await supabase
      .from('asset_cache')
      .select('asset_type')
      .gt('expires_at', now);

    const typeCounts = {};
    byType?.forEach(row => {
      typeCounts[row.asset_type] = (typeCounts[row.asset_type] || 0) + 1;
    });

    // Get breakdown by model version
    const { data: byModel } = await supabase
      .from('asset_cache')
      .select('model_version')
      .gt('expires_at', now);

    const modelCounts = {};
    byModel?.forEach(row => {
      modelCounts[row.model_version] = (modelCounts[row.model_version] || 0) + 1;
    });

    return {
      total: totalCount || 0,
      valid: validCount || 0,
      expired: expiredCount,
      byType: typeCounts,
      byModel: modelCounts,
      currentModelVersions: MODEL_VERSIONS,
      cacheVersion: CACHE_VERSION,
    };
  } catch (err) {
    logger.error({ error: err }, 'Error getting cache stats');
    return {
      total: 0,
      valid: 0,
      expired: 0,
      error: err.message,
    };
  }
}

export default {
  generateCacheKey,
  getCachedAsset,
  setCachedAsset,
  deleteCachedAsset,
  invalidateByModelVersion,
  invalidateByAssetType,
  purgeExpiredCache,
  getCacheStats,
};
