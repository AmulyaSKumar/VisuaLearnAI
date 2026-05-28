import { Router } from 'express';
import { VisualAgent, getVisual3dCacheStats } from '../../visual3d/index.js';
import { logger } from '../../services/logger.js';

const router = Router();
const agent = new VisualAgent();

const EXAMPLES = [
  'Visualize Universe',
  'Explain DNA replication',
  'Show Solar System',
  'Visualize black hole formation',
  'Explain neural networks',
  'Visualize gravity',
  'Explain recursion',
];

router.get('/examples', (req, res) => {
  res.json({
    success: true,
    examples: EXAMPLES,
    families: ['algorithm', 'spatial', 'structure', 'network', 'physics', 'abstract'],
    primitives: ['sphere', 'cube', 'cylinder', 'cone', 'ring', 'line', 'particle_system', 'helix', 'plane', 'text_label'],
    animations: ['orbit', 'rotate', 'move', 'expand', 'split', 'merge', 'pulse', 'fade', 'flow', 'particle_motion'],
    cache: getVisual3dCacheStats(),
  });
});

router.post('/generate', async (req, res) => {
  try {
    const topic = req.body?.topic || req.body?.prompt || req.body?.query;
    if (!topic) {
      return res.status(400).json({ success: false, error: 'topic, prompt, or query is required' });
    }

    const result = await agent.generate({
      topic,
      useCache: req.body?.useCache,
      debug: false,
    });

    return res.status(result.success ? 200 : 422).json(result);
  } catch (error) {
    logger.error({ error }, 'Visual3D generate failed');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Visual3D generation failed',
    });
  }
});

router.post('/debug', async (req, res) => {
  try {
    const topic = req.body?.topic || req.body?.prompt || req.body?.query || req.body?.candidateBlueprint?.topic;
    if (!topic && !req.body?.candidateBlueprint) {
      return res.status(400).json({ success: false, error: 'topic, prompt, query, or candidateBlueprint is required' });
    }

    const result = await agent.generate({
      topic,
      useCache: req.body?.useCache,
      candidateBlueprint: req.body?.candidateBlueprint,
      debug: true,
    });

    return res.status(result.success ? 200 : 422).json({
      ...result,
      cacheStats: getVisual3dCacheStats(),
    });
  } catch (error) {
    logger.error({ error }, 'Visual3D debug failed');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Visual3D debug failed',
    });
  }
});

export default router;
