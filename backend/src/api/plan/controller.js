/**
 * Plan API Controller
 * Handles learning plan generation requests
 * @module api/plan/controller
 */

import { PlannerAgent } from '../../agents/index.js';
import { MemoryManager } from '../../services/memory/index.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Generate a learning plan
 * POST /api/plan
 */
export async function generatePlan(req, res) {
  try {
    const { goal, context = '', targetLevel = 'intermediate' } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Validate input
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      throw new ValidationError('goal is required and must be a non-empty string');
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(targetLevel)) {
      throw new ValidationError(
        "targetLevel must be one of: 'beginner', 'intermediate', 'advanced'"
      );
    }

    logger.info('Plan: Request received', { goal, userId });

    // Load user profile and context
    let userProfile = {};
    let userContext = {};
    if (userId !== 'anonymous') {
      const memory = new MemoryManager(userId);
      try {
        await memory.initialize();
        userProfile = await memory.getUserProfile();
        userContext = await memory.getLearningContext();
      } catch (error) {
        logger.warn('Plan: Could not load user context', { userId, error: error.message });
      }
    }

    // Run planner agent
    const planner = new PlannerAgent();
    const result = await planner.run(
      { goal, context, targetLevel },
      { userId, userProfile, userContext }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate plan');
    }

    // Store plan in memory if user is authenticated
    if (userId !== 'anonymous' && result.result?.plan) {
      try {
        const memory = new MemoryManager(userId);
        await memory.initialize();
        // Could add plan to memory here for future reference
      } catch (error) {
        logger.warn('Plan: Could not store plan in memory', { userId, error: error.message });
      }
    }

    logger.info('Plan: Generated successfully', { goal, steps: result.result?.plan?.steps?.length });

    res.json({
      success: true,
      data: result.result,
      executionTime: result.executionTime,
    });
  } catch (error) {
    logger.error('Plan: Error', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get plan schema
 * GET /api/plan/schema
 */
export function getPlanSchema(req, res) {
  res.json({
    title: 'Learning Plan Schema',
    example: {
      title: 'Introduction to Python',
      overview: '3-step introduction to Python programming basics',
      estimatedDuration: '2-3 hours',
      prerequisites: ['Basic computer literacy'],
      learningOutcomes: [
        'Understand Python syntax',
        'Write simple programs',
      ],
      steps: [
        {
          number: 1,
          title: 'Python Basics',
          description: 'Variables, data types, and operators',
          duration: '45 mins',
          resources: [
            {
              type: 'explanation',
              content: 'Variables are containers for storing data values',
            },
          ],
        },
      ],
      checkpoints: [
        {
          step: 1,
          question: 'What is a variable?',
          expectedAnswer: 'A named container for storing data',
        },
      ],
      nextSteps: ['Control Flow', 'Functions'],
    },
  });
}
