/**
 * Feedback API Controller
 * Handles user feedback collection and retrieval
 * @module api/feedback/controller
 */

import { supabase } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Submit feedback for a message
 * POST /api/feedback
 */
export async function submitFeedback(req, res) {
  try {
    const { messageId, type, content, metadata = {} } = req.body;
    const userId = req.body.userId || req.user?.id;

    // Validate required fields
    if (!type) {
      throw new ValidationError('type is required');
    }

    const validTypes = ['thumbs_up', 'thumbs_down', 'correction', 'suggestion', 'report'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`type must be one of: ${validTypes.join(', ')}`);
    }

    logger.info('Feedback: Submitting', { userId, type, messageId });

    // Insert feedback into database
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId || null,
        message_id: messageId || null,
        type,
        content: content || null,
        metadata: {
          ...metadata,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
        processed: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Feedback: Database error', { error: error.message });
      throw new Error(`Failed to save feedback: ${error.message}`);
    }

    logger.info('Feedback: Saved successfully', { feedbackId: data.id, type });

    res.json({
      success: true,
      data: {
        id: data.id,
        type: data.type,
        createdAt: data.created_at,
      },
      message: 'Feedback submitted successfully',
    });

  } catch (error) {
    logger.error('Feedback: Submit error', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get feedback for a user
 * GET /api/feedback/user/:userId
 */
export async function getUserFeedback(req, res) {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    logger.info('Feedback: Fetching user feedback', { userId, limit, offset });

    const { data, error, count } = await supabase
      .from('feedback')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        feedback: data,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });

  } catch (error) {
    logger.error('Feedback: Fetch error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get feedback statistics
 * GET /api/feedback/stats
 */
export async function getFeedbackStats(req, res) {
  try {
    const { userId } = req.query;

    logger.info('Feedback: Fetching stats', { userId });

    // Get counts by type
    let query = supabase.from('feedback').select('type');
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    // Calculate statistics
    const stats = {
      total: data.length,
      byType: {
        thumbs_up: 0,
        thumbs_down: 0,
        correction: 0,
        suggestion: 0,
        report: 0,
      },
      satisfactionRate: 0,
    };

    data.forEach(item => {
      if (stats.byType[item.type] !== undefined) {
        stats.byType[item.type]++;
      }
    });

    // Calculate satisfaction rate
    const positive = stats.byType.thumbs_up;
    const negative = stats.byType.thumbs_down;
    if (positive + negative > 0) {
      stats.satisfactionRate = (positive / (positive + negative) * 100).toFixed(1);
    }

    res.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    logger.error('Feedback: Stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get feedback schema
 * GET /api/feedback/schema
 */
export function getFeedbackSchema(req, res) {
  res.json({
    title: 'Feedback API Schema',
    endpoints: {
      'POST /api/feedback': {
        description: 'Submit feedback for a message or general feedback',
        request: {
          messageId: 'string (optional) - ID of the message being rated',
          userId: 'string (optional) - User ID',
          type: {
            type: 'string',
            required: true,
            enum: ['thumbs_up', 'thumbs_down', 'correction', 'suggestion', 'report'],
          },
          content: 'string (optional) - Additional feedback text',
          metadata: 'object (optional) - Additional context',
        },
        response: {
          success: 'boolean',
          data: {
            id: 'string - Feedback ID',
            type: 'string - Feedback type',
            createdAt: 'string - ISO timestamp',
          },
        },
      },
      'GET /api/feedback/user/:userId': {
        description: 'Get all feedback from a user',
        params: {
          userId: 'string - User ID',
        },
        query: {
          limit: 'number (default: 50)',
          offset: 'number (default: 0)',
        },
      },
      'GET /api/feedback/stats': {
        description: 'Get feedback statistics',
        query: {
          userId: 'string (optional) - Filter by user',
        },
      },
    },
  });
}

export default {
  submitFeedback,
  getUserFeedback,
  getFeedbackStats,
  getFeedbackSchema,
};
