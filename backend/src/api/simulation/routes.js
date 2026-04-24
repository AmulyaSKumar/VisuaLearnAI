/**
 * Simulation API Routes (mounted at /api/simulation)
 *
 * NEW DYNAMIC SIMULATION ENGINE
 * - POST /api/simulation/classify - Classify query for simulation
 * - POST /api/simulation/generate - Generate simulation from inputs
 * - GET /api/simulation/generators - List available generators
 * - GET /api/simulation/generators/:key - Get generator details
 *
 * LEGACY ENDPOINTS (for backward compatibility)
 * - POST /api/simulation - Generate algorithm simulation (requires auth)
 * - POST /api/simulation/detect - Detect if query supports simulation (no auth)
 * - GET /api/simulation/types - List available simulation types (no auth)
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { rateLimitSimulation } from '../../middleware/rateLimitMiddleware.js';

// New simulation engine - import from main index to ensure generators are loaded
import {
  registry,
  classifySimulationIntent,
  mightBeSimulationRelated,
  processAllInputs,
  getSimulationFromCache,
  cacheSimulation,
  getCacheStats,
  createFallbackResponse,
  getAvailableSimulations,
  fuzzyMatchGenerator
} from '../../simulation/index.js';

const router = Router();

// ============================================
// NEW DYNAMIC SIMULATION ENGINE ROUTES
// ============================================

/**
 * POST /api/simulation/classify
 * Classify a user query for simulation intent
 * Uses LLM to determine if query is simulatable and extract parameters
 */
router.post('/classify', rateLimitSimulation, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query is required and must be a string'
      });
    }

    console.log(`[Simulation] Classifying: "${query.slice(0, 50)}..."`);

    // Quick pre-filter to avoid unnecessary LLM calls
    if (!mightBeSimulationRelated(query)) {
      console.log(`[Simulation] Quick filter: Not simulation related`);
      return res.json({
        success: true,
        simulatable: false,
        reason: 'Query does not appear to be related to algorithms or data structures',
        cached: false
      });
    }

    // Full LLM classification
    const classification = await classifySimulationIntent(query);

    console.log(`[Simulation] Classification result:`, {
      simulatable: classification.simulatable,
      algorithm: classification.algorithm,
      confidence: classification.confidence,
      cached: classification.cached
    });

    if (!classification.simulatable) {
      const fallback = createFallbackResponse(query, classification.reason);
      return res.json({
        success: true,
        ...classification,
        ...fallback
      });
    }

    // Get generator metadata
    const generator = registry.get(classification.algorithm);
    const inputSchema = generator?.inputSchema || null;
    const defaults = generator?.getDefaults() || null;

    res.json({
      success: true,
      simulatable: true,
      type: classification.type,
      algorithm: classification.algorithm,
      generatorKey: classification.algorithm,
      suggestedInputs: classification.inputs || defaults,
      inputSchema,
      confidence: classification.confidence,
      cached: classification.cached
    });

  } catch (error) {
    console.error('[Simulation] Classification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Classification failed'
    });
  }
});

/**
 * POST /api/simulation/generate
 * Generate a simulation from a generator key and inputs
 * This is deterministic - no LLM involved
 */
router.post('/generate', requireAuth, rateLimitSimulation, async (req, res) => {
  try {
    const { generatorKey, inputs } = req.body;

    if (!generatorKey || typeof generatorKey !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'generatorKey is required'
      });
    }

    console.log(`[Simulation] Generating: ${generatorKey}`);

    // Resolve generator key (handles aliases)
    const resolvedKey = fuzzyMatchGenerator(generatorKey, registry);
    if (!resolvedKey) {
      return res.status(400).json({
        success: false,
        error: `Unknown generator: ${generatorKey}`,
        availableGenerators: registry.keys()
      });
    }

    const generator = registry.get(resolvedKey);
    if (!generator) {
      return res.status(400).json({
        success: false,
        error: `Generator not found: ${resolvedKey}`
      });
    }

    // Check cache first
    const cached = getSimulationFromCache(resolvedKey, inputs);
    if (cached) {
      console.log(`[Simulation] Cache HIT for ${resolvedKey}`);
      return res.json({
        success: true,
        simulation: cached,
        source: 'cache'
      });
    }

    // Process and validate inputs
    const processed = processAllInputs(inputs || {}, generator.inputSchema);
    if (!processed.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inputs',
        details: processed.errors,
        inputSchema: generator.inputSchema
      });
    }

    // Generate simulation
    const result = generator.generate(processed.values);

    if (!result.success) {
      console.error(`[Simulation] Generation failed:`, result.error);
      return res.json({
        success: false,
        error: result.error?.message || 'Generation failed',
        hint: result.error?.hint
      });
    }

    // Cache the result
    cacheSimulation(resolvedKey, processed.values, result.simulation);

    console.log(`[Simulation] Generated ${result.simulation.steps?.length || 0} steps`);

    res.json({
      success: true,
      simulation: result.simulation,
      source: 'generated'
    });

  } catch (error) {
    console.error('[Simulation] Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Generation failed'
    });
  }
});

/**
 * GET /api/simulation/generators
 * List all available simulation generators
 */
router.get('/generators', (req, res) => {
  try {
    const generators = registry.list();
    const grouped = registry.listByType();

    res.json({
      success: true,
      count: generators.length,
      generators,
      byType: grouped
    });
  } catch (error) {
    console.error('[Simulation] List generators error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/simulation/generators/:key
 * Get details for a specific generator
 */
router.get('/generators/:key', (req, res) => {
  try {
    const { key } = req.params;
    const resolvedKey = fuzzyMatchGenerator(key, registry);

    if (!resolvedKey) {
      return res.status(404).json({
        success: false,
        error: `Generator not found: ${key}`,
        availableGenerators: registry.keys()
      });
    }

    const generator = registry.get(resolvedKey);
    const metadata = generator.getMetadata();
    const defaults = generator.getDefaults();

    res.json({
      success: true,
      generator: {
        ...metadata,
        defaults
      }
    });
  } catch (error) {
    console.error('[Simulation] Get generator error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/simulation/cache-stats
 * Get cache statistics (for debugging)
 */
router.get('/cache-stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LEGACY ROUTES (backward compatibility)
// ============================================

/**
 * POST /api/simulation/detect (LEGACY)
 * Maps to new /classify endpoint
 */
router.post('/detect', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query is required and must be a string'
      });
    }

    console.log(`[Simulation] Legacy detect: "${query.slice(0, 50)}..."`);

    // Quick pre-filter
    if (!mightBeSimulationRelated(query)) {
      return res.json({
        success: true,
        supported: false,
        type: null,
        algorithm: null,
        confidence: 0,
        reason: 'Not simulation related'
      });
    }

    // Full classification
    const classification = await classifySimulationIntent(query);

    // Map new format to legacy format
    res.json({
      success: true,
      supported: classification.simulatable,
      type: classification.type === 'array' ? 'array_sort' : classification.type,
      algorithm: classification.algorithm,
      confidence: classification.confidence,
      reason: classification.reason,
      // New fields for enhanced frontend
      generatorKey: classification.algorithm,
      suggestedInputs: classification.inputs
    });

  } catch (error) {
    console.error('[Simulation] Legacy detect error:', error);
    res.json({
      success: false,
      supported: false,
      type: null,
      algorithm: null,
      confidence: 0,
      reason: error.message || 'Detection failed'
    });
  }
});

/**
 * GET /api/simulation/types (LEGACY)
 * Returns both old format and new generators
 */
router.get('/types', (req, res) => {
  const generators = registry.list();

  res.json({
    // Legacy format
    types: [
      {
        id: 'array_sort',
        name: 'Array Sorting',
        description: 'Visualize sorting algorithms (bubble sort, quick sort, etc.)',
        keywords: ['sort', 'array', 'bubble', 'quick', 'merge', 'insertion', 'selection']
      },
      {
        id: 'array_search',
        name: 'Array Search',
        description: 'Visualize search algorithms (binary search, linear search)',
        keywords: ['search', 'binary', 'linear', 'find']
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
    ],
    // New format: list of available generators
    generators: generators.map(g => ({
      key: g.key,
      name: g.name,
      type: g.type,
      description: g.description
    }))
  });
});

/**
 * POST /api/simulation (LEGACY)
 * Generate simulation - maps to new generate endpoint
 */
router.post('/', requireAuth, rateLimitSimulation, async (req, res) => {
  try {
    const { topic, simulationType, algorithm, difficulty = 'beginner', sampleInput } = req.body;

    // Validate required fields
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required and must be a string' });
    }

    console.log(`[Simulation] Legacy generate: ${simulationType}${algorithm ? ` (${algorithm})` : ''}`);

    // If algorithm is provided, use new generator system
    if (algorithm) {
      const resolvedKey = fuzzyMatchGenerator(algorithm, registry);

      if (resolvedKey) {
        const generator = registry.get(resolvedKey);

        // Process inputs
        const inputs = sampleInput || generator.getDefaults();
        const processed = processAllInputs(inputs, generator.inputSchema);

        if (!processed.valid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid inputs',
            details: processed.errors
          });
        }

        // Check cache
        const cached = getSimulationFromCache(resolvedKey, processed.values);
        if (cached) {
          // Convert new IR format to legacy format
          return res.json({
            success: true,
            simulation: convertToLegacyFormat(cached),
            source: 'cache'
          });
        }

        // Generate
        const result = generator.generate(processed.values);

        if (result.success) {
          cacheSimulation(resolvedKey, processed.values, result.simulation);

          return res.json({
            success: true,
            simulation: convertToLegacyFormat(result.simulation),
            source: 'generated'
          });
        }
      }
    }

    // Fallback: classify and generate
    const classification = await classifySimulationIntent(topic);

    if (!classification.simulatable) {
      return res.json({
        success: false,
        error: classification.reason || 'Topic not simulatable',
        fallback: buildLegacyFallback(simulationType)
      });
    }

    const generator = registry.get(classification.algorithm);
    if (!generator) {
      return res.json({
        success: false,
        error: `No generator available for ${classification.algorithm}`,
        fallback: buildLegacyFallback(simulationType)
      });
    }

    const inputs = classification.inputs || generator.getDefaults();
    const result = generator.generate(inputs);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error?.message || 'Generation failed',
        fallback: buildLegacyFallback(simulationType)
      });
    }

    res.json({
      success: true,
      simulation: convertToLegacyFormat(result.simulation),
      source: 'generated'
    });

  } catch (error) {
    console.error('[Simulation] Legacy generate error:', error);
    res.json({
      success: false,
      error: error.message,
      fallback: buildLegacyFallback(req.body.simulationType)
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert new IR format to legacy format for backward compatibility
 */
function convertToLegacyFormat(ir) {
  if (!ir) return null;

  // For array simulations
  if (ir.type === 'array') {
    return {
      type: 'array_sort',
      algorithm: ir.algorithm,
      initialArray: ir.initial_state?.array || ir.inputs?.values?.array,
      steps: ir.steps.map((step, idx) => ({
        step: idx + 1,
        array: step.state?.array || [],
        highlight: step.highlights?.compared || step.highlights?.primary || [],
        swap: step.meta?.action === 'swap',
        description: step.meta?.description || ''
      })),
      // Include new IR for enhanced frontend
      ir
    };
  }

  // For other types, return as-is with legacy wrapper
  return {
    type: ir.type,
    algorithm: ir.algorithm,
    ...ir,
    ir
  };
}

/**
 * Build legacy fallback simulation
 */
function buildLegacyFallback(type) {
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
          { step: 1, visited: ['A'], current: 'A', queue: ['B', 'C'], description: 'Start at A' },
          { step: 2, visited: ['A', 'B'], current: 'B', queue: ['C'], description: 'Visit B' },
          { step: 3, visited: ['A', 'B', 'C'], current: 'C', queue: [], description: 'Visit C' }
        ]
      };

    case 'tree_traversal':
      return {
        type: 'tree_traversal',
        nodes: [
          { id: '1', value: 5, left: '2', right: '3' },
          { id: '2', value: 3 },
          { id: '3', value: 7 }
        ],
        steps: [
          { step: 1, current: '1', traversalOrder: [5], description: 'Visit root 5' },
          { step: 2, current: '2', traversalOrder: [5, 3], description: 'Visit left 3' },
          { step: 3, current: '3', traversalOrder: [5, 3, 7], description: 'Visit right 7' }
        ]
      };

    default:
      return null;
  }
}

export default router;
