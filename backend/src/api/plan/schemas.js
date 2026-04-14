/**
 * Plan API Schemas
 * Request/response validation schemas
 * @module api/plan/schemas
 */

export const generatePlanSchema = {
  body: {
    goal: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 500,
      description: 'Learning goal or topic to create a plan for',
    },
    context: {
      type: 'string',
      required: false,
      maxLength: 1000,
      description: 'Additional context or constraints for the plan',
    },
    targetLevel: {
      type: 'string',
      required: false,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
      description: 'Target comprehension level',
    },
  },
};

export const planResponseSchema = {
  success: 'boolean',
  data: {
    goal: 'string',
    targetLevel: 'string',
    plan: {
      title: 'string',
      overview: 'string',
      estimatedDuration: 'string',
      prerequisites: 'string[]',
      learningOutcomes: 'string[]',
      steps: [
        {
          number: 'number',
          title: 'string',
          description: 'string',
          duration: 'string',
          resources: [
            {
              type: 'string',
              content: 'string',
            },
          ],
        },
      ],
      checkpoints: [
        {
          step: 'number',
          question: 'string',
          expectedAnswer: 'string',
        },
      ],
      nextSteps: 'string[]',
    },
    generatedAt: 'string (ISO 8601)',
    userId: 'string (optional)',
  },
  executionTime: 'number (milliseconds)',
};
