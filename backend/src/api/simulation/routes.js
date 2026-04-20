/**
 * Simulation API Routes
 * POST /api/simulation - Generate algorithm simulation
 */
import { Router } from 'express';
import { simulationAgent } from '../../agents/simulation-generator.js';

const router = Router();

// In-memory cache (TTL: 30 min)
// NOTE: For production, migrate to Redis or Supabase
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Normalize topic for better cache hit rate
 * Removes filler words to match similar queries
 */
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/algorithm|example|explain|how to|what is|the|a|an/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCacheKey(topic, type, difficulty) {
  return `sim:${normalizeTopic(topic)}:${type}:${difficulty}`;
}

/**
 * Build fallback simulation when generation fails
 */
function buildFallbackSimulation(type) {
  switch (type) {
    case 'array_sort':
      return {
        type: 'array_sort',
        initialArray: [3, 1, 2],
        steps: [
          { step: 1, array: [3, 1, 2], highlight: [0, 1], swap: false, description: 'Comparing 3 and 1' },
          { step: 2, array: [1, 3, 2], highlight: [0, 1], swap: true, description: 'Swapped 3 and 1' },
          { step: 3, array: [1, 3, 2], highlight: [1, 2], swap: false, description: 'Comparing 3 and 2' },
          { step: 4, array: [1, 2, 3], highlight: [1, 2], swap: true, description: 'Swapped 3 and 2' }
        ]
      };

    case 'graph_traversal':
      return {
        type: 'graph_traversal',
        nodes: ['A', 'B', 'C'],
        edges: [['A', 'B'], ['A', 'C'], ['B', 'C']],
        steps: [
          { step: 1, visited: ['A'], current: 'A', queue: ['B', 'C'], description: 'Start at A, add neighbors to queue' },
          { step: 2, visited: ['A', 'B'], current: 'B', queue: ['C'], description: 'Visit B from queue' },
          { step: 3, visited: ['A', 'B', 'C'], current: 'C', queue: [], description: 'Visit C, traversal complete' }
        ]
      };

    case 'tree_traversal':
      return {
        type: 'tree_traversal',
        nodes: [
          { id: '1', value: 5, left: '2', right: '3' },
          { id: '2', value: 3, left: null, right: null },
          { id: '3', value: 7, left: null, right: null }
        ],
        steps: [
          { step: 1, current: '1', traversalOrder: [5], stack: ['2', '3'], description: 'Visit root node 5' },
          { step: 2, current: '2', traversalOrder: [5, 3], stack: ['3'], description: 'Visit left child 3' },
          { step: 3, current: '3', traversalOrder: [5, 3, 7], stack: [], description: 'Visit right child 7' }
        ]
      };

    default:
      return null;
  }
}

/**
 * POST /api/simulation
 * Generate step-by-step algorithm simulation
 */
router.post('/simulation', async (req, res) => {
  const { topic, simulationType, difficulty = 'beginner', sampleInput } = req.body;

  // Validate required fields
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required and must be a string' });
  }

  if (!simulationType) {
    return res.status(400).json({ error: 'simulationType is required' });
  }

  const validTypes = ['array_sort', 'graph_traversal', 'tree_traversal'];
  if (!validTypes.includes(simulationType)) {
    return res.status(400).json({
      error: `Invalid simulationType. Valid types: ${validTypes.join(', ')}`
    });
  }

  console.log(`[Simulation] Generating ${simulationType} for: "${topic.slice(0, 50)}..."`);

  try {
    const cacheKey = getCacheKey(topic, simulationType, difficulty);

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Simulation] Cache HIT: ${cacheKey}`);
      return res.json({
        success: true,
        simulation: cached.data,
        source: 'cache'
      });
    }

    console.log(`[Simulation] Cache MISS: ${cacheKey}`);

    // Generate new simulation
    const result = await simulationAgent.run({
      topic,
      simulationType,
      difficulty,
      sampleInput
    });

    if (!result.success) {
      console.error(`[Simulation] Generation failed: ${result.error}`);
      const fallback = buildFallbackSimulation(simulationType);
      return res.json({
        success: false,
        error: result.error || 'Generation failed',
        fallback,
        source: 'fallback'
      });
    }

    // Store in cache
    cache.set(cacheKey, {
      data: result.result,
      timestamp: Date.now()
    });

    // Cleanup old cache entries (keep max 100)
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    console.log(`[Simulation] Generated ${result.result.steps?.length || 0} steps`);

    res.json({
      success: true,
      simulation: result.result,
      source: 'generated',
      executionTime: result.executionTime
    });

  } catch (error) {
    console.error('[Simulation] Error:', error.message);
    const fallback = buildFallbackSimulation(simulationType);
    res.json({
      success: false,
      error: error.message,
      fallback,
      source: 'fallback'
    });
  }
});

/**
 * GET /api/simulation/types
 * List available simulation types
 */
router.get('/simulation/types', (req, res) => {
  res.json({
    types: [
      {
        id: 'array_sort',
        name: 'Array Sorting',
        description: 'Visualize sorting algorithms (bubble sort, quick sort, etc.)',
        keywords: ['sort', 'array', 'bubble', 'quick', 'merge', 'insertion', 'selection']
      },
      {
        id: 'graph_traversal',
        name: 'Graph Traversal',
        description: 'Visualize graph algorithms (BFS, DFS, etc.)',
        keywords: ['graph', 'bfs', 'dfs', 'breadth', 'depth', 'traversal', 'search']
      },
      {
        id: 'tree_traversal',
        name: 'Tree Traversal',
        description: 'Visualize tree algorithms (inorder, preorder, postorder, etc.)',
        keywords: ['tree', 'binary', 'bst', 'inorder', 'preorder', 'postorder', 'traversal']
      }
    ]
  });
});

export default router;
