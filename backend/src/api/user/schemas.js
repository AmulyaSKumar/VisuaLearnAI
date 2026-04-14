/**
 * User API Schemas
 * Request/response validation schemas
 * @module api/user/schemas
 */

export const createUserProfileSchema = {
  body: {
    userId: {
      type: 'string',
      required: true,
      description: 'Unique user identifier',
    },
    learningStyle: {
      type: 'string',
      enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
      default: 'visual',
      description: 'Initial learning style preference',
    },
  },
};

export const updateUserProfileSchema = {
  body: {
    learning_style: {
      type: 'string',
      enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
      description: 'Learning style preference',
    },
    preferred_language: {
      type: 'string',
      description: 'Preferred language for content',
    },
    comprehension_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
      description: 'Current comprehension level',
    },
    pace_preference: {
      type: 'string',
      enum: ['slow', 'normal', 'fast'],
      description: 'Preferred learning pace',
    },
    topics_of_interest: {
      type: 'array',
      items: { type: 'string' },
      description: 'Topics user is interested in',
    },
    struggling_topics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Topics user finds difficult',
    },
  },
};

export const detectLearningStyleSchema = {
  body: {
    interactions: {
      type: 'array',
      required: false,
      description: 'Array of user interactions',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['widget', 'visualization', 'audio', 'text', 'interactive', 'image'],
          },
          timestamp: { type: 'string' },
          duration: { type: 'number' },
        },
      },
    },
    topicsOfInterest: {
      type: 'array',
      required: false,
      items: { type: 'string' },
      description: 'Topics user has shown interest in',
    },
    strugglingTopics: {
      type: 'array',
      required: false,
      items: { type: 'string' },
      description: 'Topics user finds challenging',
    },
  },
};

export const userProfileResponseSchema = {
  success: 'boolean',
  data: {
    id: 'string (UUID)',
    learning_style: 'string',
    detected_styles: {
      visual: 'number (0-1)',
      auditory: 'number (0-1)',
      reading: 'number (0-1)',
      kinesthetic: 'number (0-1)',
    },
    preferred_language: 'string',
    comprehension_level: 'string',
    pace_preference: 'string',
    topics_of_interest: 'string[]',
    struggling_topics: 'string[]',
    created_at: 'string (ISO 8601)',
    updated_at: 'string (ISO 8601)',
  },
};

export const userStatsResponseSchema = {
  success: 'boolean',
  data: {
    userId: 'string',
    totalConversations: 'number',
    topicsExplored: 'string[]',
    totalInteractionTime: 'number (minutes)',
    lastActiveAt: 'string (ISO 8601) or null',
    learningStreakDays: 'number',
  },
};
