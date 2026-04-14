/**
 * Feedback Analyzer
 * Analyzes user feedback to detect patterns and improve system
 * @module feedback/analyzer
 */

import { supabase } from '../database/client.js';
import { logger } from '../utils/logger.js';

/**
 * Feedback Analyzer Class
 * Detects patterns from user feedback and suggests improvements
 */
export class FeedbackAnalyzer {
  constructor() {
    this.patterns = {
      commonIssues: [],
      successfulTopics: [],
      strugglingTopics: [],
      preferredStyles: {},
    };
  }

  /**
   * Analyze feedback for a specific user
   * @param {string} userId - User ID
   * @returns {Object} Analysis results
   */
  async analyzeUserFeedback(userId) {
    logger.info('FeedbackAnalyzer: Analyzing user feedback', { userId });

    try {
      // Fetch user's feedback
      const { data: feedback, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch feedback: ${error.message}`);
      }

      if (!feedback || feedback.length === 0) {
        return {
          userId,
          totalFeedback: 0,
          analysis: null,
          recommendations: [],
        };
      }

      // Analyze patterns
      const analysis = this._analyzePatterns(feedback);

      // Generate recommendations
      const recommendations = this._generateRecommendations(analysis);

      logger.info('FeedbackAnalyzer: Analysis complete', {
        userId,
        totalFeedback: feedback.length,
        satisfaction: analysis.satisfactionRate,
      });

      return {
        userId,
        totalFeedback: feedback.length,
        analysis,
        recommendations,
      };

    } catch (error) {
      logger.error('FeedbackAnalyzer: Analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze system-wide feedback patterns
   * @returns {Object} System-wide analysis
   */
  async analyzeSystemFeedback() {
    logger.info('FeedbackAnalyzer: Analyzing system-wide feedback');

    try {
      // Fetch recent feedback
      const { data: feedback, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        throw new Error(`Failed to fetch feedback: ${error.message}`);
      }

      const analysis = this._analyzePatterns(feedback || []);

      // Extract common issues from corrections
      const corrections = (feedback || []).filter(f => f.type === 'correction');
      const issues = this._extractCommonIssues(corrections);

      // Extract successful patterns from thumbs_up
      const positive = (feedback || []).filter(f => f.type === 'thumbs_up');
      const successPatterns = this._extractSuccessPatterns(positive);

      return {
        totalFeedback: (feedback || []).length,
        analysis,
        commonIssues: issues,
        successPatterns,
        recommendations: this._generateSystemRecommendations(analysis, issues),
      };

    } catch (error) {
      logger.error('FeedbackAnalyzer: System analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze feedback patterns
   * @private
   */
  _analyzePatterns(feedback) {
    const counts = {
      thumbs_up: 0,
      thumbs_down: 0,
      correction: 0,
      suggestion: 0,
      report: 0,
    };

    const timeDistribution = {
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
    };

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    feedback.forEach(f => {
      // Count by type
      if (counts[f.type] !== undefined) {
        counts[f.type]++;
      }

      // Time distribution
      const created = new Date(f.created_at);
      const age = now - created;
      if (age < day) timeDistribution.last24h++;
      if (age < week) timeDistribution.lastWeek++;
      if (age < month) timeDistribution.lastMonth++;
    });

    // Calculate satisfaction rate
    const positive = counts.thumbs_up;
    const negative = counts.thumbs_down;
    const satisfactionRate = positive + negative > 0
      ? (positive / (positive + negative) * 100).toFixed(1)
      : 0;

    // Calculate correction rate
    const total = feedback.length;
    const correctionRate = total > 0
      ? (counts.correction / total * 100).toFixed(1)
      : 0;

    return {
      counts,
      timeDistribution,
      satisfactionRate: parseFloat(satisfactionRate),
      correctionRate: parseFloat(correctionRate),
      totalFeedback: total,
    };
  }

  /**
   * Extract common issues from corrections
   * @private
   */
  _extractCommonIssues(corrections) {
    const issueKeywords = {};

    corrections.forEach(c => {
      const content = (c.content || '').toLowerCase();
      const metadata = c.metadata || {};

      // Extract keywords from content
      const words = content.split(/\s+/).filter(w => w.length > 4);
      words.forEach(word => {
        issueKeywords[word] = (issueKeywords[word] || 0) + 1;
      });

      // Extract from metadata if available
      if (metadata.topic) {
        issueKeywords[metadata.topic] = (issueKeywords[metadata.topic] || 0) + 1;
      }
    });

    // Sort by frequency
    return Object.entries(issueKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  /**
   * Extract success patterns from positive feedback
   * @private
   */
  _extractSuccessPatterns(positive) {
    const patterns = {
      topics: {},
      widgetTypes: {},
      learningStyles: {},
    };

    positive.forEach(p => {
      const metadata = p.metadata || {};

      if (metadata.topic) {
        patterns.topics[metadata.topic] = (patterns.topics[metadata.topic] || 0) + 1;
      }

      if (metadata.widgetType) {
        patterns.widgetTypes[metadata.widgetType] = (patterns.widgetTypes[metadata.widgetType] || 0) + 1;
      }

      if (metadata.learningStyle) {
        patterns.learningStyles[metadata.learningStyle] = (patterns.learningStyles[metadata.learningStyle] || 0) + 1;
      }
    });

    return patterns;
  }

  /**
   * Generate recommendations for a user
   * @private
   */
  _generateRecommendations(analysis) {
    const recommendations = [];

    // Low satisfaction rate
    if (analysis.satisfactionRate < 70) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        message: 'Consider reviewing recent responses for quality issues',
        metric: `Current satisfaction: ${analysis.satisfactionRate}%`,
      });
    }

    // High correction rate
    if (analysis.correctionRate > 20) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        message: 'High correction rate detected - fact-checking may need improvement',
        metric: `Correction rate: ${analysis.correctionRate}%`,
      });
    }

    // Positive trend
    if (analysis.satisfactionRate > 90) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        message: 'Excellent user satisfaction! Continue current approach',
        metric: `Satisfaction: ${analysis.satisfactionRate}%`,
      });
    }

    return recommendations;
  }

  /**
   * Generate system-wide recommendations
   * @private
   */
  _generateSystemRecommendations(analysis, issues) {
    const recommendations = [];

    // System satisfaction
    if (analysis.satisfactionRate < 80) {
      recommendations.push({
        type: 'system',
        priority: 'high',
        action: 'Review widget generation quality',
        reason: `System satisfaction at ${analysis.satisfactionRate}%`,
      });
    }

    // Common issues
    if (issues.length > 0) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        action: `Address common issue keywords: ${issues.slice(0, 3).map(i => i.keyword).join(', ')}`,
        reason: 'Frequently mentioned in corrections',
      });
    }

    // High volume
    if (analysis.timeDistribution.last24h > 50) {
      recommendations.push({
        type: 'monitoring',
        priority: 'low',
        action: 'Monitor system performance',
        reason: `High feedback volume: ${analysis.timeDistribution.last24h} in last 24h`,
      });
    }

    return recommendations;
  }

  /**
   * Process unprocessed feedback and mark as processed
   * @returns {Object} Processing results
   */
  async processNewFeedback() {
    logger.info('FeedbackAnalyzer: Processing new feedback');

    try {
      // Get unprocessed feedback
      const { data: unprocessed, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch unprocessed feedback: ${error.message}`);
      }

      if (!unprocessed || unprocessed.length === 0) {
        return { processed: 0, insights: [] };
      }

      // Analyze the batch
      const analysis = this._analyzePatterns(unprocessed);
      const insights = [];

      // Generate insights
      if (analysis.counts.thumbs_down > analysis.counts.thumbs_up) {
        insights.push({
          type: 'alert',
          message: 'More negative feedback than positive in recent batch',
          data: analysis.counts,
        });
      }

      if (analysis.counts.correction > 5) {
        insights.push({
          type: 'accuracy',
          message: 'Multiple corrections submitted - review content accuracy',
          count: analysis.counts.correction,
        });
      }

      // Mark as processed
      const ids = unprocessed.map(f => f.id);
      const { error: updateError } = await supabase
        .from('feedback')
        .update({ processed: true })
        .in('id', ids);

      if (updateError) {
        logger.warn('FeedbackAnalyzer: Failed to mark as processed', { error: updateError.message });
      }

      logger.info('FeedbackAnalyzer: Processing complete', {
        processed: unprocessed.length,
        insights: insights.length,
      });

      return {
        processed: unprocessed.length,
        analysis,
        insights,
      };

    } catch (error) {
      logger.error('FeedbackAnalyzer: Processing failed', { error: error.message });
      throw error;
    }
  }
}

export default FeedbackAnalyzer;
