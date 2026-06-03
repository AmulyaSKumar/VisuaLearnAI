/**
 * API Routes Module
 * Central route registration with authentication and rate limiting
 * @module api
 */

import express from 'express';
import userRoutes from './user/routes.js';
import planRoutes from './plan/routes.js';
import assetRoutes from './assets/routes.js';
import feedbackRoutes from './feedback/routes.js';
import learningContentRoutes from './learning/index.js';
import ttsRoutes from './tts/routes.js';
import documentRoutes from './documents/routes.js';
import resourceRoutes from './resources/routes.js';
import personaRoutes from './personas/routes.js';
import simulationRoutes from './simulation/routes.js';
import visual3dRoutes from './visual3d/routes.js';
import notionRoutes, { notionCallbackRoutes } from './notion/routes.js';
import chatRoutes from '../../routes/chat.js';
import { generateAssets, getAssetSchema } from './assets/controller.js';

// Authentication middleware
import { requireAuth, requireAuthAndOwnership, optionalAuth } from '../middleware/authMiddleware.js';

// Rate limiting middleware
import {
  rateLimitChat,
  rateLimitAssets,
  rateLimitTts,
  rateLimitPlan,
  rateLimitLearningContent,
} from '../middleware/rateLimitMiddleware.js';

// Cost tracking
import { getUsageStats } from '../services/costTracker.js';

// Learning state service
import { getUserProgress, getWeakTopics, getStrongTopics } from '../services/learningState.js';

// Personalization metrics
import { trackSessionMetrics } from '../agents/personalization.js';

// Asset cache service
import {
  invalidateByModelVersion,
  invalidateByAssetType,
  purgeExpiredCache,
  getCacheStats,
} from '../services/assetCache.js';

// Circuit breaker
import { agentRegistry } from '../agents/index.js';

// Logger
import { logger } from '../services/logger.js';

/**
 * Admin user IDs from environment
 * Comma-separated list of user IDs with admin access
 */
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

/**
 * Register all API routes
 * @param {express.Application} app - Express app instance
 */
export function registerRoutes(app) {
  const router = express.Router();

  /**
   * Usage API
   * GET /api/usage/:userId - Get user's daily usage statistics
   */
  router.get('/usage/:id', requireAuthAndOwnership, (req, res) => {
    const stats = getUsageStats(req.user.userId);
    res.json(stats);
  });

  /**
   * Learning Progress API
   * GET /api/progress/:userId - Get user's learning progress
   */
  router.get('/progress/:id', requireAuthAndOwnership, async (req, res) => {
    try {
      const progress = await getUserProgress(req.user.userId);

      if (!progress) {
        return res.status(404).json({ error: 'No progress found' });
      }

      // Add weak and strong topics
      const [weakTopics, strongTopics] = await Promise.all([
        getWeakTopics(req.user.userId),
        getStrongTopics(req.user.userId),
      ]);

      res.json({
        ...progress,
        weakTopics,
        strongTopics,
      });
    } catch (err) {
      console.error('Error fetching progress:', err);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  /**
   * Behavior Tracking API
   * POST /api/behavior - Record aggregate behavior metrics for personalization
   */
  router.post('/behavior', requireAuth, async (req, res) => {
    try {
      const userId = req.user.userId;
      const requestedUserId = req.body?.userId;

      if (requestedUserId && requestedUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden: user ID mismatch' });
      }

      await trackSessionMetrics(userId, {
        timeSpent: Number(req.body?.sessionDuration) || 0,
        interactions: Number(req.body?.totalInteractions) || 0,
        followUpCount: Number(req.body?.followUpCount) || 0,
        widgetInteractions: Number(req.body?.widgetInteractionCount) || 0,
      });

      res.json({ success: true });
    } catch (err) {
      logger.error({ error: err.message, userId: req.user?.userId }, 'Behavior tracking failed');
      res.status(500).json({ error: 'Failed to track behavior' });
    }
  });

  /**
   * Chat API (Streaming responses) - Protected + Rate Limited
   * POST /api/chat - Stream responses via SSE
   * POST /api/tool-result - Handle widget rendering
   */
  router.post('/chat', requireAuth, rateLimitChat, (req, res, next) => {
    // Inject authenticated userId into request body for downstream use
    req.body.userId = req.user.userId;
    next();
  });
  router.post('/tool-result', requireAuth, rateLimitChat, (req, res, next) => {
    req.body.userId = req.user.userId;
    next();
  });
  router.use('/', chatRoutes);

  /**
   * User API (Profile & Personalization) - Protected + Ownership Check
   * POST /api/user - Create user profile
   * GET /api/user/:id - Get user profile
   * PUT /api/user/:id - Update profile
   * GET /api/user/:id/stats - Get user stats
   * GET /api/user/:id/metrics - Get user metrics
   * POST /api/user/:id/detect-style - Detect learning style
   */
  router.use('/user', requireAuth);
  router.use('/user/:id', requireAuthAndOwnership);
  router.use('/user', userRoutes);

  /**
   * Planner API - Protected + Rate Limited
   * POST /api/plan - Generate learning plan
   * GET /api/plan/schema - Get plan schema
   */
  router.post('/plan', requireAuth, rateLimitPlan);
  router.use('/plan', planRoutes);

  /**
   * Asset Generation API - Protected + Rate Limited
   * POST /api/generate-assets - Generate widgets/diagrams (SSE streaming)
   * GET /api/assets/schema - Get asset schema
   */
  router.use('/assets', requireAuth);
  router.post('/generate-assets', requireAuth, rateLimitAssets, generateAssets);
  router.get('/assets/schema', requireAuth, getAssetSchema);

  /**
   * Feedback API - Protected
   * POST /api/feedback - Submit feedback
   * GET /api/feedback/stats - Get feedback statistics
   * GET /api/feedback/user/:userId - Get user feedback (ownership checked in route)
   */
  router.use('/feedback', requireAuth);
  router.use('/feedback', feedbackRoutes);

  /**
   * Learning Content API - Protected + Rate Limited
   * POST /api/learning-content - Generate comprehensive learning content
   * POST /api/learning-content/quiz-answer - Process quiz answers
   * POST /api/learning-content/track-interaction - Track user interactions
   * POST /api/learning-content/regenerate-block - Regenerate a single block
   */
  router.post('/learning-content', requireAuth, rateLimitLearningContent);
  router.post('/learning-content/quiz-answer', requireAuth);
  router.post('/learning-content/track-interaction', requireAuth);
  router.post('/learning-content/regenerate-block', requireAuth, rateLimitLearningContent);
  router.use('/', learningContentRoutes);

  /**
   * TTS (Text-to-Speech) API - Protected + Rate Limited
   * POST /api/tts - Convert text to speech
   */
  router.post('/tts', requireAuth, rateLimitTts);
  router.use('/tts', ttsRoutes);

  /**
   * Documents API (RAG) - Protected
   * POST /api/documents/upload - Upload PDF document
   * GET /api/documents - List user's documents
   * GET /api/documents/:id - Get document status
   * DELETE /api/documents/:id - Delete document
   * POST /api/documents/:id/query - Query document with RAG
   * GET /api/documents/:id/summary - Get document summary
   */
  router.use('/documents', requireAuth, documentRoutes);

  /**
   * Notion Export API
   * GET /api/notion/connect - Start Notion OAuth
   * GET /api/notion/callback - Notion OAuth callback
   * GET /api/notion/status - Get connection status
   * DELETE /api/notion/disconnect - Remove Notion connection
   * POST /api/notion/export - Export structured learning resources
   *
   * Keep this before broad protected mounts.
   * OAuth callbacks are browser redirects and cannot include an Authorization header.
   */
  router.use('/notion', notionCallbackRoutes);
  router.use('/notion', requireAuth, notionRoutes);

  /**
   * Learning Resources API - Protected
   * GET /api/resources/:conversationId - Get all resources for conversation
   * GET /api/resources/:conversationId/types - Get available resource types
   * GET /api/resources/:conversationId/:resourceType - Get specific resource
   * POST /api/resources/:conversationId - Save a resource
   * DELETE /api/resources/:conversationId/:resourceId - Delete a resource
   */
  router.use('/resources', requireAuth, resourceRoutes);

  /**
   * Personas API - Protected
   * GET /api/personas - List user's personas + system personas
   * GET /api/personas/default - Get user's default persona
   * GET /api/personas/:id - Get single persona
   * POST /api/personas - Create custom persona
   * PUT /api/personas/:id - Update custom persona
   * DELETE /api/personas/:id - Delete custom persona
   * POST /api/personas/:id/set-default - Set as default persona
   */
  router.use('/personas', requireAuth, personaRoutes);

  /**
   * Simulation API
   * POST /api/simulation/debug - Console-first sandbox simulation engine
   * POST /api/simulation/detect - Topic simulation support detection
   * POST /api/simulation/generate - Compatibility alias for sandbox generation
   */
  router.use('/simulation', simulationRoutes);

  /**
   * Visual3D API
   * POST /api/visual3d/generate - Generate a validated procedural 3D scene blueprint
   * POST /api/visual3d/debug - Return topic analysis, tool outputs, validation, and trace logs
   * GET /api/visual3d/examples - List supported debug examples and capabilities
   */
  router.use('/visual3d', visual3dRoutes);

  /**
   * Admin API - Requires admin user
   */

  // Middleware to check admin access
  const requireAdmin = (req, res, next) => {
    if (!req.user || !ADMIN_USER_IDS.includes(req.user.userId)) {
      logger.warn({ userId: req.user?.userId }, 'Unauthorized admin access attempt');
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  /**
   * POST /api/admin/invalidate-cache - Invalidate asset cache
   * Body: { assetType?: string, modelVersion?: string }
   */
  router.post('/admin/invalidate-cache', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { assetType, modelVersion } = req.body;
      let deleted = 0;

      if (modelVersion) {
        deleted = await invalidateByModelVersion(modelVersion);
      } else if (assetType) {
        deleted = await invalidateByAssetType(assetType);
      } else {
        // Purge all expired entries
        deleted = await purgeExpiredCache();
      }

      logger.info({
        admin: req.user.userId,
        assetType,
        modelVersion,
        deleted,
      }, 'Admin cache invalidation');

      res.json({
        success: true,
        deleted,
        message: modelVersion
          ? `Invalidated ${deleted} entries for model ${modelVersion}`
          : assetType
            ? `Invalidated ${deleted} entries for type ${assetType}`
            : `Purged ${deleted} expired entries`,
      });
    } catch (err) {
      logger.error({ error: err }, 'Admin cache invalidation failed');
      res.status(500).json({ error: 'Cache invalidation failed' });
    }
  });

  /**
   * GET /api/admin/cache-stats - Get cache statistics
   */
  router.get('/admin/cache-stats', requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await getCacheStats();
      res.json(stats);
    } catch (err) {
      logger.error({ error: err }, 'Failed to get cache stats');
      res.status(500).json({ error: 'Failed to get cache stats' });
    }
  });

  /**
   * GET /api/admin/circuit-breakers - Get circuit breaker status
   */
  router.get('/admin/circuit-breakers', requireAuth, requireAdmin, (req, res) => {
    try {
      const status = agentRegistry.getCircuitBreakerStatus();
      res.json(status);
    } catch (err) {
      logger.error({ error: err }, 'Failed to get circuit breaker status');
      res.status(500).json({ error: 'Failed to get circuit breaker status' });
    }
  });

  /**
   * POST /api/admin/circuit-breakers/reset - Reset circuit breakers
   * Body: { agentName?: string }
   */
  router.post('/admin/circuit-breakers/reset', requireAuth, requireAdmin, (req, res) => {
    try {
      const { agentName } = req.body;

      if (agentName) {
        agentRegistry.resetCircuitBreaker(agentName);
        logger.info({ admin: req.user.userId, agentName }, 'Circuit breaker reset');
        res.json({ success: true, message: `Circuit breaker reset for ${agentName}` });
      } else {
        agentRegistry.resetAllCircuitBreakers();
        logger.info({ admin: req.user.userId }, 'All circuit breakers reset');
        res.json({ success: true, message: 'All circuit breakers reset' });
      }
    } catch (err) {
      logger.error({ error: err }, 'Failed to reset circuit breaker');
      res.status(500).json({ error: 'Failed to reset circuit breaker' });
    }
  });

  /**
   * GET /api/admin/agents - Get agent statistics
   */
  router.get('/admin/agents', requireAuth, requireAdmin, (req, res) => {
    try {
      const summary = agentRegistry.summary();
      res.json(summary);
    } catch (err) {
      logger.error({ error: err }, 'Failed to get agent stats');
      res.status(500).json({ error: 'Failed to get agent stats' });
    }
  });

  /**
   * 404 handler for API routes
   * Returns JSON instead of HTML for missing API endpoints
   */
  router.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `API endpoint ${req.method} ${req.path} does not exist`,
      availableEndpoints: [
        'POST /api/chat',
        'POST /api/tool-result',
        'POST /api/learning-content',
        'POST /api/behavior',
        'POST /api/simulation/debug',
        'POST /api/simulation/detect',
        'POST /api/simulation/generate',
        'POST /api/simulation/feedback',
        'POST /api/visual3d/generate',
        'POST /api/visual3d/debug',
        'GET /api/visual3d/examples',
        'POST /api/tts',
        'POST /api/plan',
        'POST /api/generate-assets',
        'POST /api/feedback',
        'GET /api/personas',
        'POST /api/personas',
        'GET /api/personas/default',
        'POST /api/personas/:id/set-default',
        'GET /api/usage/:userId',
        'GET /api/progress/:userId',
        'GET /api/health'
      ]
    });
  });

  app.use('/api', router);

  return app;
}

export default registerRoutes;
