/**
 * Feedback API Routes
 * @module api/feedback/routes
 */

import express from 'express';
import {
  submitFeedback,
  getUserFeedback,
  getFeedbackStats,
  getFeedbackSchema,
} from './controller.js';

const router = express.Router();

// POST /api/feedback - Submit feedback
router.post('/', submitFeedback);

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats', getFeedbackStats);

// GET /api/feedback/schema - Get API schema
router.get('/schema', getFeedbackSchema);

// GET /api/feedback/user/:userId - Get user's feedback
router.get('/user/:userId', getUserFeedback);

export default router;
