/**
 * AI-only adaptive simulation API.
 *
 * All runtime simulation output is generated through the agent pipeline in
 * simulation/adaptive-engine.js. Predefined generator registries and static
 * topic routing are intentionally not imported here.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { rateLimitSimulation } from '../../middleware/rateLimitMiddleware.js';
import {
  generateAdaptiveSimulation,
  recordSimulationFeedback,
  topicUnderstandingAgent,
} from '../../simulation/adaptive-engine.js';

const router = Router();

function getUserId(req) {
  return req.body?.userId || req.user?.id || req.user?.userId || null;
}

/**
 * POST /api/simulation/detect
 * Topic Understanding Agent only.
 */
router.post('/detect', rateLimitSimulation, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        supported: false,
        error: 'query is required and must be a string',
      });
    }

    const topicUnderstanding = await topicUnderstandingAgent(query);
    return res.json({
      success: true,
      supported: topicUnderstanding.supported !== false,
      topic: topicUnderstanding.topic,
      domain: topicUnderstanding.domain,
      complexity: topicUnderstanding.complexity,
      educationalIntent: topicUnderstanding.educationalIntent,
      simulationType: topicUnderstanding.simulationType,
      confidence: topicUnderstanding.confidence,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      supported: false,
      error: error.message || 'Simulation detection failed',
    });
  }
});

/**
 * POST /api/simulation/generate
 * Full adaptive simulation pipeline.
 */
router.post('/generate', requireAuth, rateLimitSimulation, async (req, res) => {
  try {
    const {
      query,
      conversationId = null,
      previousSimulationId = null,
      feedbackContext = null,
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query is required and must be a string',
      });
    }

    const result = await generateAdaptiveSimulation(query, {
      userId: getUserId(req),
      conversationId,
      previousSimulationId,
      feedbackContext,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Simulation generation failed',
    });
  }
});

/**
 * POST /api/simulation/feedback
 * Store simulation-specific feedback for future adaptation.
 */
router.post('/feedback', requireAuth, rateLimitSimulation, async (req, res) => {
  try {
    const { simulationId, type, score = null, reason = null } = req.body;
    if (!simulationId || typeof simulationId !== 'string') {
      return res.status(400).json({ success: false, error: 'simulationId is required' });
    }

    if (!['helpful', 'not_useful', 'regenerate'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be one of: helpful, not_useful, regenerate',
      });
    }

    await recordSimulationFeedback({
      simulationId,
      userId: getUserId(req),
      type,
      score,
      reason,
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Simulation feedback failed',
    });
  }
});

/**
 * Compatibility wrapper for old POST /api/simulation callers.
 * It still runs the AI-only pipeline and never uses predefined generators.
 */
router.post('/', requireAuth, rateLimitSimulation, async (req, res) => {
  try {
    const query = req.body.query || req.body.topic;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query or topic is required and must be a string',
      });
    }

    const result = await generateAdaptiveSimulation(query, {
      userId: getUserId(req),
      conversationId: req.body.conversationId || null,
      feedbackContext: req.body.feedbackContext || null,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Simulation generation failed',
    });
  }
});

/**
 * Compatibility discovery endpoint. No predefined simulation catalog exists.
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    types: [],
    message: 'Simulations are generated dynamically by the adaptive agent pipeline.',
  });
});

router.get('/generators', (req, res) => {
  res.json({
    success: true,
    count: 0,
    generators: [],
    message: 'No predefined generators are used at runtime.',
  });
});

router.get('/generators/:key', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Predefined simulation generators are disabled. Use POST /api/simulation/generate.',
  });
});

router.get('/cache-stats', (req, res) => {
  res.json({
    success: true,
    stats: null,
    message: 'Template simulation cache is disabled for AI-only simulations.',
  });
});

export default router;
