/**
 * User Routes
 * User profile and personalization endpoints
 * @module api/user/routes
 */

import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  detectLearningStyle,
  createUserProfile,
  getUserStats,
  getUserMetrics,
  processOnboardingQuiz,
  getOnboardingStatus,
} from './controller.js';

const router = Router();

// POST /api/user - Create user profile
router.post('/', createUserProfile);

// GET /api/user/:id - Get user profile
router.get('/:id', getUserProfile);

// PUT /api/user/:id - Update user profile
router.put('/:id', updateUserProfile);

// POST /api/user/:id/detect-style - Detect learning style
router.post('/:id/detect-style', detectLearningStyle);

// GET /api/user/:id/stats - Get user stats
router.get('/:id/stats', getUserStats);

// GET /api/user/:id/metrics - Get user metrics (engagement, improvement, satisfaction)
router.get('/:id/metrics', getUserMetrics);

// POST /api/user/:id/onboarding-quiz - Process onboarding quiz results
router.post('/:id/onboarding-quiz', processOnboardingQuiz);

// GET /api/user/:id/onboarding-status - Check if user needs onboarding
router.get('/:id/onboarding-status', getOnboardingStatus);

export default router;
