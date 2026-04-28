/**
 * Evaluation Module
 * A/B testing and metrics comparison support
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { FAILSAFE_ACTION } from './algorithm.js';

// Evaluation configuration
const EVALUATION_CONFIG = {
  enabled: process.env.BANDIT_EVALUATION_MODE === 'true',
  baselineAction: process.env.BANDIT_BASELINE_ACTION || FAILSAFE_ACTION,
  sampleRate: parseFloat(process.env.BANDIT_BASELINE_SAMPLE_RATE || '0.1'),
};

/**
 * Get evaluation mode configuration
 */
export function getEvaluationMode() {
  return {
    enabled: EVALUATION_CONFIG.enabled,
    baseline: EVALUATION_CONFIG.baselineAction,
    sampleRate: EVALUATION_CONFIG.sampleRate,
  };
}

/**
 * Hash userId for consistent assignment
 */
function hashUserId(userId) {
  if (!userId) return Math.random() * 100;
  const hash = crypto.createHash('md5').update(userId).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

/**
 * Determine if request should use baseline (for A/B testing)
 * Uses consistent hashing so same user always gets same assignment
 */
export function shouldUseBaseline(userId) {
  if (!EVALUATION_CONFIG.enabled) return false;

  const hash = hashUserId(userId);
  return hash < (EVALUATION_CONFIG.sampleRate * 100);
}

/**
 * Get baseline decision (for A/B testing)
 */
export function getBaselineDecision(context) {
  return {
    selectedAction: EVALUATION_CONFIG.baselineAction,
    source: 'baseline',
    scores: {},
    isBaseline: true,
  };
}

/**
 * Evaluation Metrics Collector
 */
export class EvaluationMetrics {
  constructor() {
    this.banditResults = [];
    this.baselineResults = [];
    this.windowSize = 1000;
  }

  /**
   * Record result from bandit
   */
  recordBanditResult(result) {
    this.banditResults.push({
      ...result,
      ts: Date.now(),
    });

    if (this.banditResults.length > this.windowSize) {
      this.banditResults.shift();
    }
  }

  /**
   * Record result from baseline
   */
  recordBaselineResult(result) {
    this.baselineResults.push({
      ...result,
      ts: Date.now(),
    });

    if (this.baselineResults.length > this.windowSize) {
      this.baselineResults.shift();
    }
  }

  /**
   * Calculate metrics for a result set
   */
  _calculateMetrics(results) {
    if (results.length === 0) {
      return {
        count: 0,
        avgReward: null,
        avgEngagement: null,
        avgCompletion: null,
        successRate: null,
      };
    }

    const count = results.length;
    const withReward = results.filter(r => r.reward != null);
    const withEngagement = results.filter(r => r.engagement != null);
    const withCompletion = results.filter(r => r.completion != null);
    const successes = results.filter(r => r.success === true);

    return {
      count,
      avgReward: withReward.length > 0
        ? withReward.reduce((s, r) => s + r.reward, 0) / withReward.length
        : null,
      avgEngagement: withEngagement.length > 0
        ? withEngagement.reduce((s, r) => s + r.engagement, 0) / withEngagement.length
        : null,
      avgCompletion: withCompletion.length > 0
        ? withCompletion.reduce((s, r) => s + r.completion, 0) / withCompletion.length
        : null,
      successRate: successes.length / count,
    };
  }

  /**
   * Get comparison metrics
   */
  getComparison() {
    const bandit = this._calculateMetrics(this.banditResults);
    const baseline = this._calculateMetrics(this.baselineResults);

    // Calculate improvement if both have data
    let comparison = null;
    if (bandit.avgReward != null && baseline.avgReward != null) {
      comparison = {
        rewardImprovement: bandit.avgReward - baseline.avgReward,
        rewardImprovementPercent: baseline.avgReward > 0
          ? ((bandit.avgReward - baseline.avgReward) / baseline.avgReward) * 100
          : null,
        engagementImprovement: bandit.avgEngagement != null && baseline.avgEngagement != null
          ? bandit.avgEngagement - baseline.avgEngagement
          : null,
        successRateImprovement: baseline.successRate != null
          ? bandit.successRate - baseline.successRate
          : null,
      };
    }

    return {
      bandit,
      baseline,
      comparison,
      evaluationEnabled: EVALUATION_CONFIG.enabled,
      sampleRate: EVALUATION_CONFIG.sampleRate,
    };
  }

  /**
   * Get time series data for visualization
   */
  getTimeSeries(bucketMs = 60000) {
    const buckets = {};

    const processResults = (results, group) => {
      results.forEach(r => {
        const bucket = Math.floor(r.ts / bucketMs) * bucketMs;
        if (!buckets[bucket]) {
          buckets[bucket] = { ts: bucket, bandit: [], baseline: [] };
        }
        buckets[bucket][group].push(r);
      });
    };

    processResults(this.banditResults, 'bandit');
    processResults(this.baselineResults, 'baseline');

    return Object.values(buckets)
      .sort((a, b) => a.ts - b.ts)
      .map(bucket => ({
        ts: bucket.ts,
        bandit: this._calculateMetrics(bucket.bandit),
        baseline: this._calculateMetrics(bucket.baseline),
      }));
  }
}

// Singleton metrics collector
export const evaluationMetrics = new EvaluationMetrics();

/**
 * Log evaluation metrics periodically
 */
export function logEvaluationMetrics() {
  const metrics = evaluationMetrics.getComparison();

  if (metrics.bandit.count > 0 || metrics.baseline.count > 0) {
    logger.info({
      type: 'bandit_evaluation_metrics',
      bandit: metrics.bandit,
      baseline: metrics.baseline,
      comparison: metrics.comparison,
    }, 'Evaluation metrics');
  }

  return metrics;
}

/**
 * Query historical evaluation data from database
 * @param {Object} supabase - Supabase client
 * @param {Object} options - Query options
 */
export async function queryEvaluationData(supabase, options = {}) {
  const {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
    endDate = new Date(),
    limit = 1000,
  } = options;

  try {
    // Query bandit decisions
    const { data: decisions, error } = await supabase
      .from('bandit_decisions')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error({ error }, 'Failed to query evaluation data');
      return null;
    }

    // Separate bandit and baseline
    const banditDecisions = decisions.filter(d => !d.is_baseline);
    const baselineDecisions = decisions.filter(d => d.is_baseline);

    // Calculate metrics
    const calculateFromDecisions = (decisions) => {
      const resolved = decisions.filter(d => d.reward_status === 'resolved');
      return {
        total: decisions.length,
        resolved: resolved.length,
        avgReward: resolved.length > 0
          ? resolved.reduce((s, d) => s + (d.final_reward || 0), 0) / resolved.length
          : null,
        byAction: decisions.reduce((acc, d) => {
          if (!acc[d.selected_action]) acc[d.selected_action] = 0;
          acc[d.selected_action]++;
          return acc;
        }, {}),
      };
    };

    return {
      bandit: calculateFromDecisions(banditDecisions),
      baseline: calculateFromDecisions(baselineDecisions),
      dateRange: { start: startDate, end: endDate },
    };
  } catch (error) {
    logger.error({ error }, 'Error querying evaluation data');
    return null;
  }
}
