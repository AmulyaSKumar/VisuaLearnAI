/**
 * Sandboxed simulation API.
 *
 * Runtime simulation output is produced by simulation/sandbox-engine.js.
 * Old predefined renderer registries and adaptive renderer files are not used.
 */
import { Router } from 'express';
import { rateLimitSimulation } from '../../middleware/rateLimitMiddleware.js';
import {
  detectSandboxSimulationSupport,
  generateSandboxSimulation,
} from '../../simulation/sandbox-engine.js';
import {
  LearningOrchestratorDecision,
} from '../../services/learningOrchestratorDecision.js';

const router = Router();

function getUserId(req) {
  return req.body?.userId || req.user?.id || req.user?.userId || null;
}

/**
 * POST /api/simulation/debug
 * Console-first sandbox simulation engine.
 */
router.post('/debug', rateLimitSimulation, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        supported: false,
        error: 'query is required and must be a string',
      });
    }

    const result = await generateSandboxSimulation(query, options);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      supported: false,
      error: error.message || 'Sandbox simulation debug failed',
    });
  }
});

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

    const decision = LearningOrchestratorDecision({
      query,
      mode: req.body.mode || 'chat',
      conversationState: req.body.conversationState || {},
      requestedArtifact: req.body.requestedArtifact || null,
    });
    const support = detectSandboxSimulationSupport(decision.activeTopic || query, {
      explicitQuery: query,
      requestedArtifact: req.body.requestedArtifact || null,
    });

    return res.json({
      success: true,
      supported: support.supported,
      topic: support.topic,
      family: support.family,
      domain: support.domain,
      complexity: support.complexity,
      educationalIntent: support.reason,
      simulationType: support.simulationType,
      confidence: support.confidence,
      requiresSandbox: support.requiresSandbox,
      explicit: support.explicit,
      reason: support.reason,
      plan: support.plan,
      decision,
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
 * Compatibility alias for the sandbox engine.
 */
router.post('/generate', rateLimitSimulation, async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query is required and must be a string',
      });
    }

    const result = await generateSandboxSimulation(query, {
      ...options,
      userId: getUserId(req),
      conversationId: req.body.conversationId || options.conversationId || null,
      decision: req.body.decision || options.decision || null,
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
 * Compatibility no-op. The sandbox debug flow does not mutate model state.
 */
router.post('/feedback', rateLimitSimulation, async (req, res) => {
  try {
    const { simulationId, type } = req.body;
    if (!simulationId || typeof simulationId !== 'string') {
      return res.status(400).json({ success: false, error: 'simulationId is required' });
    }

    if (!['helpful', 'not_useful', 'regenerate'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be one of: helpful, not_useful, regenerate',
      });
    }

    return res.json({ success: true, stored: false, message: 'Sandbox feedback is accepted but not persisted.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Simulation feedback failed',
    });
  }
});

/**
 * Compatibility wrapper for old POST /api/simulation callers.
 * It still runs the sandbox engine and never uses predefined generators.
 */
router.post('/', rateLimitSimulation, async (req, res) => {
  try {
    const query = req.body.query || req.body.topic;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query or topic is required and must be a string',
      });
    }

    const result = await generateSandboxSimulation(query, {
      userId: getUserId(req),
      conversationId: req.body.conversationId || null,
      decision: req.body.decision || null,
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
