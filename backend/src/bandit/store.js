/**
 * Bandit Persistence Store
 * Handles atomic persistence of LinUCB parameters to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { serializeMatrix, serializeVector, deserializeMatrix, deserializeVector } from './algorithm.js';
import { CONTEXT_VERSION } from './context.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

/**
 * Get Supabase client (lazy initialization)
 */
function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

/**
 * BanditStore class for persisting bandit state
 */
export class BanditStore {
  constructor(options = {}) {
    this.tableName = options.tableName || 'bandit_linucb_params';
    this.decisionsTable = options.decisionsTable || 'bandit_decisions';
    this.inMemoryFallback = new Map();
    this.useInMemory = options.useInMemory || false;
  }

  /**
   * Save LinUCB parameters for an action
   * Uses atomic upsert to prevent partial writes
   */
  async saveLinUCBParameters(action, params) {
    if (this.useInMemory || !getSupabase()) {
      this.inMemoryFallback.set(`linucb_${action}`, {
        ...params,
        updatedAt: Date.now(),
      });
      return true;
    }

    try {
      const serialized = {
        A: serializeMatrix(params.A),
        b: serializeVector(params.b),
        updateCount: params.updateCount,
        version: params.version || CONTEXT_VERSION,
      };

      const { error } = await getSupabase()
        .from(this.tableName)
        .upsert({
          action,
          parameters: JSON.stringify(serialized),
          version: params.version || CONTEXT_VERSION,
          update_count: params.updateCount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'action',
        });

      if (error) {
        logger.error({ error, action }, 'Failed to save LinUCB parameters');
        // Fall back to in-memory
        this.inMemoryFallback.set(`linucb_${action}`, {
          ...params,
          updatedAt: Date.now(),
        });
        return false;
      }

      logger.debug({ action, updateCount: params.updateCount }, 'LinUCB params persisted');
      return true;
    } catch (error) {
      logger.error({ error, action }, 'LinUCB persistence exception');
      // Fall back to in-memory
      this.inMemoryFallback.set(`linucb_${action}`, {
        ...params,
        updatedAt: Date.now(),
      });
      return false;
    }
  }

  /**
   * Load LinUCB parameters for an action
   */
  async loadLinUCBParameters(action) {
    // Check in-memory fallback first
    const inMemory = this.inMemoryFallback.get(`linucb_${action}`);
    if (this.useInMemory) {
      return inMemory || null;
    }

    if (!getSupabase()) {
      return inMemory || null;
    }

    try {
      const { data, error } = await getSupabase()
        .from(this.tableName)
        .select('*')
        .eq('action', action)
        .single();

      if (error || !data) {
        if (error?.code !== 'PGRST116') { // Not found is OK
          logger.warn({ error, action }, 'LinUCB load query failed');
        }
        return inMemory || null;
      }

      const params = JSON.parse(data.parameters);
      return {
        A: deserializeMatrix(params.A),
        b: deserializeVector(params.b),
        updateCount: data.update_count || params.updateCount || 0,
        version: data.version || params.version,
      };
    } catch (error) {
      logger.warn({ error, action }, 'LinUCB load exception - using in-memory fallback');
      return inMemory || null;
    }
  }

  /**
   * Save a bandit decision record
   */
  async saveDecision(decision) {
    if (this.useInMemory || !getSupabase()) {
      const key = `decision_${decision.id}`;
      this.inMemoryFallback.set(key, decision);
      return true;
    }

    try {
      const { error } = await getSupabase()
        .from(this.decisionsTable)
        .insert({
          id: decision.id,
          user_id: decision.userId,
          conversation_id: decision.conversationId,
          topic_key: decision.topicKey,
          topic_label: decision.topicLabel,
          context_vector: decision.context?.vector,
          context_key: decision.context?.contextKey,
          context_labels: decision.context?.labels,
          context_version: decision.context?.version,
          selected_action: decision.selectedAction,
          decision_source: decision.decisionSource,
          scores: decision.scores,
          cold_start: decision.coldStart,
          is_baseline: decision.isBaseline || false,
          shadow: decision.shadow || false,
          reward_status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) {
        logger.error({ error, decisionId: decision.id }, 'Failed to save bandit decision');
        return false;
      }

      logger.debug({ decisionId: decision.id, action: decision.selectedAction }, 'Bandit decision saved');
      return true;
    } catch (error) {
      logger.error({ error, decisionId: decision.id }, 'Bandit decision save exception');
      return false;
    }
  }

  /**
   * Update decision with reward
   */
  async resolveDecision(decisionId, reward) {
    if (this.useInMemory || !getSupabase()) {
      const key = `decision_${decisionId}`;
      const decision = this.inMemoryFallback.get(key);
      if (decision) {
        decision.reward = reward;
        decision.rewardStatus = 'resolved';
        decision.resolvedAt = Date.now();
      }
      return true;
    }

    try {
      const { error } = await getSupabase()
        .from(this.decisionsTable)
        .update({
          final_reward: reward.reward,
          reward_components: reward.components,
          reward_status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', decisionId);

      if (error) {
        logger.error({ error, decisionId }, 'Failed to resolve bandit decision');
        return false;
      }

      logger.debug({ decisionId, reward: reward.reward }, 'Bandit decision resolved');
      return true;
    } catch (error) {
      logger.error({ error, decisionId }, 'Bandit decision resolve exception');
      return false;
    }
  }

  /**
   * Get pending decisions for a user (for reward attribution)
   */
  async getPendingDecisions(userId, topicKey = null, limit = 10) {
    if (this.useInMemory || !getSupabase()) {
      const decisions = [];
      for (const [key, value] of this.inMemoryFallback.entries()) {
        if (key.startsWith('decision_') && value.userId === userId && value.rewardStatus !== 'resolved') {
          if (!topicKey || value.topicKey === topicKey) {
            decisions.push(value);
          }
        }
      }
      return decisions.slice(0, limit);
    }

    try {
      let query = getSupabase()
        .from(this.decisionsTable)
        .select('*')
        .eq('user_id', userId)
        .eq('reward_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (topicKey) {
        query = query.eq('topic_key', topicKey);
      }

      const { data, error } = await query;

      if (error) {
        logger.warn({ error, userId }, 'Failed to get pending decisions');
        return [];
      }

      return data || [];
    } catch (error) {
      logger.warn({ error, userId }, 'Get pending decisions exception');
      return [];
    }
  }

  /**
   * Get decision by ID
   */
  async getDecision(decisionId) {
    if (this.useInMemory || !getSupabase()) {
      return this.inMemoryFallback.get(`decision_${decisionId}`) || null;
    }

    try {
      const { data, error } = await getSupabase()
        .from(this.decisionsTable)
        .select('*')
        .eq('id', decisionId)
        .single();

      if (error) {
        logger.warn({ error, decisionId }, 'Failed to get decision');
        return null;
      }

      return data;
    } catch (error) {
      logger.warn({ error, decisionId }, 'Get decision exception');
      return null;
    }
  }

  /**
   * Get action statistics for monitoring
   */
  async getActionStats(timeRangeMs = 24 * 60 * 60 * 1000) {
    if (this.useInMemory || !getSupabase()) {
      const stats = {};
      const cutoff = Date.now() - timeRangeMs;

      for (const [key, value] of this.inMemoryFallback.entries()) {
        if (key.startsWith('decision_') && value.createdAt >= cutoff) {
          const action = value.selectedAction;
          if (!stats[action]) {
            stats[action] = { count: 0, resolved: 0, totalReward: 0 };
          }
          stats[action].count++;
          if (value.rewardStatus === 'resolved') {
            stats[action].resolved++;
            stats[action].totalReward += value.reward?.reward || 0;
          }
        }
      }

      return stats;
    }

    try {
      const cutoff = new Date(Date.now() - timeRangeMs).toISOString();

      const { data, error } = await getSupabase()
        .from(this.decisionsTable)
        .select('selected_action, reward_status, final_reward')
        .gte('created_at', cutoff);

      if (error) {
        logger.warn({ error }, 'Failed to get action stats');
        return {};
      }

      const stats = {};
      for (const row of data || []) {
        const action = row.selected_action;
        if (!stats[action]) {
          stats[action] = { count: 0, resolved: 0, totalReward: 0 };
        }
        stats[action].count++;
        if (row.reward_status === 'resolved') {
          stats[action].resolved++;
          stats[action].totalReward += row.final_reward || 0;
        }
      }

      // Calculate averages
      for (const action of Object.keys(stats)) {
        stats[action].avgReward = stats[action].resolved > 0
          ? stats[action].totalReward / stats[action].resolved
          : null;
      }

      return stats;
    } catch (error) {
      logger.warn({ error }, 'Get action stats exception');
      return {};
    }
  }

  /**
   * Check if persistence is available
   */
  isAvailable() {
    return this.useInMemory || !!getSupabase();
  }

  /**
   * Clear in-memory fallback (for testing)
   */
  clearInMemory() {
    this.inMemoryFallback.clear();
  }
}

// Singleton store instance
export const banditStore = new BanditStore();

/**
 * Create store with custom options
 */
export function createBanditStore(options) {
  return new BanditStore(options);
}

/**
 * SQL for creating the bandit tables (run once in Supabase)
 */
export const SCHEMA_SQL = `
-- LinUCB parameters storage
CREATE TABLE IF NOT EXISTS bandit_linucb_params (
  action TEXT PRIMARY KEY,
  parameters JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  update_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bandit decisions log
CREATE TABLE IF NOT EXISTS bandit_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID,
  topic_key TEXT,
  topic_label TEXT,
  context_vector FLOAT8[],
  context_key TEXT,
  context_labels JSONB,
  context_version INTEGER,
  selected_action TEXT NOT NULL,
  decision_source TEXT,
  scores JSONB,
  cold_start BOOLEAN DEFAULT FALSE,
  is_baseline BOOLEAN DEFAULT FALSE,
  shadow BOOLEAN DEFAULT FALSE,
  reward_status TEXT DEFAULT 'pending',
  final_reward FLOAT8,
  reward_components JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bandit_decisions_user_id ON bandit_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_bandit_decisions_topic_key ON bandit_decisions(topic_key);
CREATE INDEX IF NOT EXISTS idx_bandit_decisions_created_at ON bandit_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_bandit_decisions_reward_status ON bandit_decisions(reward_status);
`;
