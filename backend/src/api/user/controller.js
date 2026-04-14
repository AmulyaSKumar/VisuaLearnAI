/**
 * User API Controller
 * Handles user profile and personalization
 * @module api/user/controller
 */

import { PersonalizationAgent } from '../../agents/index.js';
import { MemoryManager } from '../../services/memory/index.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { getUserMetrics as fetchUserMetrics } from '../../agents/personalization.js';

/**
 * Get user profile
 * GET /api/user/:id
 */
export async function getUserProfile(req, res) {
  try {
    const { id: userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    logger.info('User: Get profile', { userId });

    const memory = new MemoryManager(userId);
    await memory.initialize();

    const profile = await memory.getUserProfile();

    if (!profile) {
      throw new NotFoundError(`User profile not found for ${userId}`);
    }

    logger.debug('User: Profile retrieved', { userId });

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('User: Error getting profile', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Update user profile
 * PUT /api/user/:id
 */
export async function updateUserProfile(req, res) {
  try {
    const { id: userId } = req.params;
    const updates = req.body;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new ValidationError('At least one field must be provided to update');
    }

    logger.info('User: Update profile', { userId });

    const memory = new MemoryManager(userId);
    await memory.initialize();

    // Update the profile
    const updatedProfile = await memory.updateUserProfile(updates);

    logger.info('User: Profile updated', { userId });

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('User: Error updating profile', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Detect learning style
 * POST /api/user/:id/detect-style
 */
export async function detectLearningStyle(req, res) {
  try {
    const { id: userId } = req.params;
    const { interactions = [], topicsOfInterest = [], strugglingTopics = [] } = req.body;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    logger.info('User: Detect learning style', { userId, interactions: interactions.length });

    // Load current user profile
    const memory = new MemoryManager(userId);
    await memory.initialize();
    const userProfile = await memory.getUserProfile();

    // Run personalization agent
    const personalizer = new PersonalizationAgent();
    const result = await personalizer.run(
      { userId, interactions, topicsOfInterest, strugglingTopics },
      { userProfile }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to detect learning style');
    }

    // Update user profile with detected style
    const updatedProfile = await memory.updateUserProfile(result.result.profile);

    logger.info('User: Learning style detected', {
      userId,
      style: result.result.profile.primaryStyle,
    });

    res.json({
      success: true,
      data: {
        profile: updatedProfile,
        recommendations: result.result.recommendations,
        analysis: result.result.analysisDetails,
      },
      executionTime: result.executionTime,
    });
  } catch (error) {
    logger.error('User: Error detecting style', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Create or initialize user profile
 * POST /api/user
 */
export async function createUserProfile(req, res) {
  try {
    const { userId, learningStyle = 'visual' } = req.body;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('userId is required');
    }

    logger.info('User: Create profile', { userId });

    const memory = new MemoryManager(userId);
    await memory.initialize();

    const profile = await memory.updateUserProfile({
      learning_style: learningStyle,
      detected_styles: {
        visual: 0.25,
        auditory: 0.25,
        reading: 0.25,
        kinesthetic: 0.25,
      },
      preferred_language: 'en',
      comprehension_level: 'intermediate',
      pace_preference: 'normal',
    });

    logger.info('User: Profile created', { userId });

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('User: Error creating profile', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get user stats and progress
 * GET /api/user/:id/stats
 */
export async function getUserStats(req, res) {
  try {
    const { id: userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    logger.info('User: Get stats', { userId });

    const memory = new MemoryManager(userId);
    await memory.initialize();

    // Get conversation stats
    const learningContext = await memory.getLearningContext();

    const stats = {
      userId,
      totalConversations: learningContext.conversationCount || 0,
      topicsExplored: learningContext.topicsExplored || [],
      totalInteractionTime: learningContext.totalTime || 0,
      lastActiveAt: learningContext.lastActive || null,
      learningStreakDays: learningContext.streakDays || 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('User: Error getting stats', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get user metrics (engagement, improvement, satisfaction)
 * GET /api/user/:id/metrics
 */
export async function getUserMetrics(req, res) {
  try {
    const { id: userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    logger.info('User: Get metrics', { userId });

    const metrics = await fetchUserMetrics(userId);

    if (!metrics) {
      throw new NotFoundError(`Metrics not found for user ${userId}`);
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('User: Error getting metrics', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Process onboarding quiz results
 * POST /api/user/:id/onboarding-quiz
 */
export async function processOnboardingQuiz(req, res) {
  try {
    const { id: userId } = req.params;
    const { responses } = req.body;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      throw new ValidationError('Quiz responses are required');
    }

    logger.info('User: Process onboarding quiz', { userId, responseCount: responses.length });

    // Calculate VARK scores
    const scores = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0,
    };

    responses.forEach(response => {
      if (scores.hasOwnProperty(response.style)) {
        scores[response.style]++;
      }
    });

    // Calculate percentages
    const total = responses.length;
    const percentages = {
      visual: Math.round((scores.visual / total) * 100) / 100,
      auditory: Math.round((scores.auditory / total) * 100) / 100,
      reading: Math.round((scores.reading / total) * 100) / 100,
      kinesthetic: Math.round((scores.kinesthetic / total) * 100) / 100,
    };

    // Find dominant style
    let dominant = 'visual';
    let maxScore = scores.visual;
    for (const [style, score] of Object.entries(scores)) {
      if (score > maxScore) {
        dominant = style;
        maxScore = score;
      }
    }

    // Update user profile
    const memory = new MemoryManager(userId);
    await memory.initialize();

    const updatedProfile = await memory.updateUserProfile({
      learning_style: dominant,
      detected_styles: percentages,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    });

    logger.info('User: Onboarding quiz completed', {
      userId,
      learningStyle: dominant,
      percentages,
    });

    res.json({
      success: true,
      data: {
        learningStyle: dominant,
        detectedStyles: percentages,
        profile: updatedProfile,
      },
      message: `Learning style detected: ${dominant}`,
    });
  } catch (error) {
    logger.error('User: Error processing onboarding quiz', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Check if user needs onboarding
 * GET /api/user/:id/onboarding-status
 */
export async function getOnboardingStatus(req, res) {
  try {
    const { id: userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    const memory = new MemoryManager(userId);
    await memory.initialize();

    const profile = await memory.getUserProfile();

    // User needs onboarding if:
    // 1. No profile exists
    // 2. learning_style is null or undefined
    // 3. onboarding_completed is false or undefined
    const needsOnboarding = !profile ||
      !profile.learning_style ||
      !profile.onboarding_completed;

    res.json({
      success: true,
      data: {
        needsOnboarding,
        learningStyle: profile?.learning_style || null,
        onboardingCompleted: profile?.onboarding_completed || false,
      },
    });
  } catch (error) {
    logger.error('User: Error checking onboarding status', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}
