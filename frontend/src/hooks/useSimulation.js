import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * FALLBACK: Detect simulation type from topic keywords
 * Only used when backend detection is not available
 */
function detectSimulationTypeFallback(topic) {
  const lower = topic.toLowerCase();

  // Array/sorting algorithms
  if (
    lower.includes('sort') ||
    lower.includes('bubble') ||
    lower.includes('quick') ||
    lower.includes('merge') ||
    lower.includes('insertion') ||
    lower.includes('selection') ||
    lower.includes('heap') ||
    lower.includes('array')
  ) {
    return { type: 'array_sort', algorithm: extractAlgorithm(lower, 'sort') };
  }

  // Search algorithms
  if (
    lower.includes('binary search') ||
    lower.includes('linear search') ||
    lower.includes('search algorithm')
  ) {
    return { type: 'array_search', algorithm: extractAlgorithm(lower, 'search') };
  }

  // Graph algorithms
  if (
    lower.includes('graph') ||
    lower.includes('bfs') ||
    lower.includes('dfs') ||
    lower.includes('breadth') ||
    lower.includes('depth') ||
    lower.includes('dijkstra') ||
    lower.includes('path')
  ) {
    return { type: 'graph_traversal', algorithm: extractAlgorithm(lower, 'graph') };
  }

  // Tree algorithms
  if (
    lower.includes('tree') ||
    lower.includes('binary') ||
    lower.includes('bst') ||
    lower.includes('inorder') ||
    lower.includes('preorder') ||
    lower.includes('postorder') ||
    lower.includes('levelorder') ||
    lower.includes('level order') ||
    lower.includes('traversal')
  ) {
    return { type: 'tree_traversal', algorithm: extractAlgorithm(lower, 'tree') };
  }

  // Grid algorithms
  if (
    lower.includes('grid') ||
    lower.includes('flood') ||
    lower.includes('fill') ||
    lower.includes('a*') ||
    lower.includes('astar') ||
    lower.includes('a star') ||
    lower.includes('pathfind') ||
    lower.includes('maze')
  ) {
    return { type: 'grid', algorithm: extractAlgorithm(lower, 'grid') };
  }

  return null;
}

/**
 * Valid algorithm mappings per type
 * Used for mismatch protection
 */
const VALID_ALGORITHMS = {
  array_sort: ['bubble', 'quick', 'merge', 'insertion', 'selection', 'heap'],
  array_search: ['binary', 'linear'],
  graph_traversal: ['bfs', 'dfs', 'dijkstra'],
  tree_traversal: ['inorder', 'preorder', 'postorder', 'levelorder'],
  grid: ['flood_fill', 'a_star', 'pathfinding']
};

/**
 * Map legacy algorithm names to new generator keys
 */
const ALGORITHM_TO_GENERATOR_KEY = {
  // Sorting
  'bubble': 'bubble_sort',
  'quick': 'quick_sort',
  'merge': 'merge_sort',
  'insertion': 'insertion_sort',
  'selection': 'selection_sort',
  'heap': 'heap_sort',
  // Search
  'binary': 'binary_search',
  'linear': 'linear_search',
  // Graph
  'bfs': 'bfs',
  'dfs': 'dfs',
  'dijkstra': 'dijkstra',
  // Tree
  'inorder': 'inorder_traversal',
  'preorder': 'preorder_traversal',
  'postorder': 'postorder_traversal',
  'levelorder': 'levelorder_traversal',
  // Grid
  'flood_fill': 'flood_fill',
  'a_star': 'a_star',
  'pathfinding': 'a_star',
};

/**
 * Validate that algorithm matches type
 * Returns corrected algorithm or default if mismatch
 */
function validateAlgorithm(type, algorithm) {
  if (!type || !VALID_ALGORITHMS[type]) {
    return { valid: false, algorithm: null };
  }

  const validAlgos = VALID_ALGORITHMS[type];
  const normalizedAlgo = algorithm?.toLowerCase().replace(/[\s-_]/g, '');

  if (normalizedAlgo && validAlgos.includes(normalizedAlgo)) {
    return { valid: true, algorithm: normalizedAlgo };
  }

  // Mismatch detected - return default for this type
  const defaultAlgo = validAlgos[0];
  if (algorithm) {
    console.warn(`[useSimulation] Algorithm mismatch: "${algorithm}" invalid for ${type}, using "${defaultAlgo}"`);
  }
  return { valid: false, algorithm: defaultAlgo };
}

/**
 * Extract specific algorithm from query text
 */
function extractAlgorithm(text, category) {
  if (category === 'sort') {
    if (text.includes('bubble')) return 'bubble';
    if (text.includes('quick')) return 'quick';
    if (text.includes('merge')) return 'merge';
    if (text.includes('insertion')) return 'insertion';
    if (text.includes('selection')) return 'selection';
    if (text.includes('heap')) return 'heap';
    return 'bubble'; // default
  }
  if (category === 'search') {
    if (text.includes('binary')) return 'binary';
    if (text.includes('linear')) return 'linear';
    return 'binary'; // default
  }
  if (category === 'graph') {
    if (text.includes('bfs') || text.includes('breadth')) return 'bfs';
    if (text.includes('dfs') || text.includes('depth')) return 'dfs';
    if (text.includes('dijkstra')) return 'dijkstra';
    return 'bfs'; // default
  }
  if (category === 'tree') {
    if (text.includes('inorder') || text.includes('in-order')) return 'inorder';
    if (text.includes('preorder') || text.includes('pre-order')) return 'preorder';
    if (text.includes('postorder') || text.includes('post-order')) return 'postorder';
    if (text.includes('levelorder') || text.includes('level-order') || text.includes('level order')) return 'levelorder';
    return 'inorder'; // default
  }
  if (category === 'grid') {
    if (text.includes('flood') || text.includes('fill')) return 'flood_fill';
    if (text.includes('a*') || text.includes('astar') || text.includes('a star')) return 'a_star';
    if (text.includes('pathfind') || text.includes('path find')) return 'a_star';
    if (text.includes('maze')) return 'a_star';
    return 'flood_fill'; // default
  }
  return null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook for fetching and managing algorithm simulations
 *
 * UPDATED: Now supports the new dynamic simulation engine with:
 * - LLM-based classification via /api/simulation/classify
 * - Deterministic generation via /api/simulation/generate
 * - User-editable inputs with live regeneration
 * - Backward compatible with legacy API
 *
 * @param {string} topic - The algorithm topic to simulate
 * @param {object} options - Additional options
 * @param {object} options.detection - Backend simulation detection result (preferred)
 * @param {string} options.difficulty - Difficulty level (beginner/intermediate/advanced)
 * @param {boolean} options.autoFetch - Whether to auto-fetch on mount
 * @param {string} options.accessToken - Auth token
 * @param {boolean} options.useNewAPI - Whether to use new dynamic simulation API
 * @returns {object} Simulation state and controls
 */
export default function useSimulation(topic, options = {}) {
  const {
    detection = null, // Backend detection result (source of truth)
    difficulty = 'beginner',
    autoFetch = true,
    accessToken = null,
    useNewAPI = true, // Use new dynamic simulation engine by default
  } = options;

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  // New API state
  const [generatorKey, setGeneratorKey] = useState(null);
  const [userInputs, setUserInputs] = useState({});
  const [inputSchema, setInputSchema] = useState(null);

  // Duplication guard: track in-flight request
  const fetchingRef = useRef(false);
  const lastFetchKeyRef = useRef(null);
  // Debounce timer for input changes
  const debounceTimerRef = useRef(null);
  // Track last topic to prevent duplicate fetches
  const lastTopicRef = useRef(null);
  // Track if we've already determined this topic is not simulatable
  const notSimulatableRef = useRef(false);

  /**
   * Fetch simulation using new dynamic API
   */
  const fetchWithNewAPI = useCallback(async (targetTopic, forceInputs = null) => {
    // Generate unique key for this fetch
    const fetchKey = `new:${targetTopic}:${detection?.algorithm || ''}`;

    // Guard: prevent duplicate fetches
    if (fetchingRef.current && lastFetchKeyRef.current === fetchKey && !forceInputs) {
      console.log('[useSimulation] Duplicate fetch blocked:', fetchKey.slice(0, 40));
      return;
    }

    fetchingRef.current = true;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    setError(null);

    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      // Step 1: Classify the query (if we don't have detection from backend)
      let classificationResult = null;

      if (detection?.supported && detection?.algorithm) {
        // Use existing detection
        classificationResult = {
          simulatable: true,
          algorithm: detection.algorithm,
          generatorKey: detection.generatorKey || ALGORITHM_TO_GENERATOR_KEY[detection.algorithm] || detection.algorithm,
          suggestedInputs: detection.suggestedInputs,
          inputSchema: detection.inputSchema,
          confidence: detection.confidence
        };
      } else {
        // Classify via new API
        const classifyResponse = await fetch(`${API_BASE}/api/simulation/classify`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: targetTopic })
        });
        classificationResult = await classifyResponse.json();

        if (!classificationResult.success) {
          throw new Error(classificationResult.error || 'Classification failed');
        }

        if (!classificationResult.simulatable) {
          setError(classificationResult.reason || 'Topic not simulatable');
          setSimulation(null);
          setSource(null);
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Store classification info
      setGeneratorKey(classificationResult.generatorKey || classificationResult.algorithm);
      setInputSchema(classificationResult.inputSchema);

      // Use forceInputs if provided, otherwise use suggested inputs
      const inputs = forceInputs || userInputs || classificationResult.suggestedInputs || {};
      if (!forceInputs) {
        setUserInputs(inputs);
      }

      // Step 2: Generate simulation
      const generateResponse = await fetch(`${API_BASE}/api/simulation/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          generatorKey: classificationResult.generatorKey || classificationResult.algorithm,
          inputs
        })
      });

      const generateResult = await generateResponse.json();

      if (!generateResult.success) {
        throw new Error(generateResult.error || 'Generation failed');
      }

      // Convert new IR to legacy format for SimulationView compatibility
      const legacySimulation = convertIRToLegacy(generateResult.simulation);
      setSimulation(legacySimulation);
      setSource(generateResult.source);

      console.log('[useSimulation] New API success:', {
        generator: classificationResult.generatorKey,
        steps: generateResult.simulation?.steps?.length,
        source: generateResult.source
      });

    } catch (err) {
      console.error('[useSimulation] New API error:', err);
      setError(err.message);
      setSimulation(null);
      setSource(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [detection, accessToken, userInputs]);

  /**
   * Fetch simulation using legacy API (backward compatibility)
   */
  const fetchWithLegacyAPI = useCallback(async (targetTopic) => {
    // Generate unique key for this fetch
    const fetchKey = `legacy:${targetTopic}:${detection?.type}:${detection?.algorithm}`;

    // Guard: prevent duplicate fetches
    if (fetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      console.log('[useSimulation] Duplicate fetch blocked:', fetchKey.slice(0, 40));
      return;
    }

    fetchingRef.current = true;
    lastFetchKeyRef.current = fetchKey;

    // Determine type and algorithm
    let simulationType, algorithm, detectionMethod;

    if (detection?.supported && detection?.type) {
      simulationType = detection.type;
      const validation = validateAlgorithm(detection.type, detection.algorithm);
      algorithm = validation.algorithm;
      detectionMethod = 'backend';
    } else {
      const fallbackDetection = detectSimulationTypeFallback(targetTopic);
      if (!fallbackDetection) {
        setError('This topic does not support simulation visualization');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
      simulationType = fallbackDetection.type;
      algorithm = fallbackDetection.algorithm;
      detectionMethod = 'fallback';
    }

    console.log('[Simulation] Legacy API:', {
      type: simulationType,
      algorithm,
      source: detectionMethod,
      topic: targetTopic.slice(0, 30)
    });

    setLoading(true);
    setError(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/simulation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: targetTopic,
          simulationType,
          algorithm,
          difficulty
        })
      });

      const data = await response.json();

      if (!data.success) {
        if (data.fallback) {
          setSimulation(data.fallback);
          setSource('fallback');
          console.warn('[useSimulation] Using fallback:', data.error);
        } else {
          throw new Error(data.error || 'Failed to generate simulation');
        }
      } else {
        setSimulation(data.simulation);
        setSource(data.source);
      }
    } catch (err) {
      console.error('[useSimulation] Legacy API error:', err);
      setError(err.message);
      setSimulation(null);
      setSource(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [detection, difficulty, accessToken]);

  /**
   * Main fetch function - decides which API to use
   */
  const fetchSimulation = useCallback(async (overrideTopic) => {
    const targetTopic = overrideTopic || topic;
    if (!targetTopic) return;

    if (useNewAPI) {
      await fetchWithNewAPI(targetTopic);
    } else {
      await fetchWithLegacyAPI(targetTopic);
    }
  }, [topic, useNewAPI, fetchWithNewAPI, fetchWithLegacyAPI]);

  /**
   * Regenerate simulation with new inputs (debounced)
   */
  const regenerateWithInputs = useCallback((newInputs) => {
    if (!generatorKey || !topic) return;

    // Update local state immediately
    setUserInputs(newInputs);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce regeneration (300ms)
    debounceTimerRef.current = setTimeout(() => {
      console.log('[useSimulation] Regenerating with new inputs');
      fetchWithNewAPI(topic, newInputs);
    }, 300);
  }, [generatorKey, topic, fetchWithNewAPI]);

  /**
   * Update a single input value
   */
  const updateInput = useCallback((key, value) => {
    const newInputs = { ...userInputs, [key]: value };
    regenerateWithInputs(newInputs);
  }, [userInputs, regenerateWithInputs]);

  // Auto-fetch when topic or detection changes
  useEffect(() => {
    if (!autoFetch || !topic) return;

    // Guard: don't re-fetch if already loading
    if (loading || fetchingRef.current) {
      return;
    }

    // Guard: don't re-fetch for the same topic we've already processed
    const topicKey = `${topic}:${detection?.supported}:${detection?.algorithm || 'none'}`;
    if (lastTopicRef.current === topicKey) {
      return;
    }

    // If backend says not supported, mark it and don't fetch
    if (detection && !detection.supported) {
      lastTopicRef.current = topicKey;
      notSimulatableRef.current = true;
      setError('This topic does not support simulation visualization');
      setSimulation(null);
      return;
    }

    // If we have simulation already for this topic, don't refetch
    if (simulation && lastTopicRef.current?.startsWith(topic)) {
      return;
    }

    // If detection is null, wait for it (don't try to classify ourselves)
    // This prevents duplicate API calls when LearningPage is already detecting
    if (!detection) {
      console.log('[useSimulation] Waiting for detection from LearningPage');
      return;
    }

    // Only fetch if detection says it's supported
    if (detection.supported) {
      lastTopicRef.current = topicKey;
      notSimulatableRef.current = false;
      fetchSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, topic, detection]);

  // Track previous topic for reset logic
  const prevTopicRef = useRef(null);

  // Reset state when topic changes
  useEffect(() => {
    // Only reset if topic actually changed (not just re-render)
    if (prevTopicRef.current && prevTopicRef.current !== topic) {
      console.log('[useSimulation] Topic changed, resetting state:', topic?.slice(0, 30));
      setSimulation(null);
      setError(null);
      setSource(null);
      setGeneratorKey(null);
      setUserInputs({});
      setInputSchema(null);
      // Reset refs for new topic
      notSimulatableRef.current = false;
      fetchingRef.current = false;
      lastFetchKeyRef.current = null;
      lastTopicRef.current = null;
    }
    prevTopicRef.current = topic;
  }, [topic]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Determine effective type for display
  const effectiveType = useMemo(() => {
    return detection?.type ||
      simulation?.type ||
      detectSimulationTypeFallback(topic || '')?.type ||
      null;
  }, [detection, simulation, topic]);

  return {
    // Core state
    simulation,
    loading,
    error,
    source,
    refetch: fetchSimulation,

    // Validation
    isValid: simulation && Array.isArray(simulation.steps) && simulation.steps.length > 0,

    // Computed values
    stepCount: simulation?.steps?.length || 0,
    simulationType: effectiveType,

    // New API features
    generatorKey,
    userInputs,
    inputSchema,
    updateInput,
    regenerateWithInputs,

    // Detection info
    detectionSource: detection ? 'backend' : 'fallback',
    detectionConfidence: detection?.confidence || null
  };
}

/**
 * Convert new IR format to legacy format for SimulationView compatibility
 */
function convertIRToLegacy(ir) {
  if (!ir) return null;

  // Check if it already has legacy fields
  if (ir.initialArray || ir.nodes || ir.type === 'graph_traversal' || ir.type === 'tree_traversal') {
    return ir;
  }

  // Convert new IR format
  if (ir.type === 'array') {
    const isSearch = ir.algorithm?.includes('search');
    return {
      // Legacy fields
      type: isSearch ? 'array_search' : 'array_sort',
      algorithm: ir.algorithm,
      initialArray: ir.initial_state?.array || ir.inputs?.values?.array,
      steps: ir.steps.map((step, idx) => ({
        step: idx + 1,
        array: step.state?.array || [],
        highlight: step.highlights?.compared || step.highlights?.primary || [],
        current: step.highlights?.current,
        visited: step.highlights?.visited,
        sorted: step.highlights?.sorted,
        swap: step.meta?.action === 'swap',
        description: step.meta?.description || ''
      })),
      // Keep new IR for enhanced features
      ir,
      // New metadata
      title: ir.title,
      complexity: ir.complexity,
      inputSchema: ir.inputs?.schema
    };
  }

  // Convert graph type
  if (ir.type === 'graph') {
    const graphData = ir.initial_state?.graph || ir.inputs?.values?.graph || {};
    return {
      type: 'graph_traversal',
      algorithm: ir.algorithm,
      nodes: graphData.nodes || [],
      edges: graphData.edges || [],
      steps: ir.steps.map((step, idx) => ({
        step: idx + 1,
        // State data
        current: step.highlights?.current || null,
        visited: step.highlights?.visited || [],
        queue: step.state?.queue || [],
        stack: step.state?.stack || [],
        traversalOrder: step.state?.traversalOrder || [],
        distances: step.state?.distances || {},
        // Highlight data
        highlights: step.highlights || {},
        // Description
        description: step.meta?.description || ''
      })),
      // Keep new IR for enhanced features
      ir,
      // New metadata
      title: ir.title,
      complexity: ir.complexity,
      inputSchema: ir.inputs?.schema
    };
  }

  // Convert tree type
  if (ir.type === 'tree') {
    const treeData = ir.initial_state?.tree || ir.inputs?.values?.tree || {};
    return {
      type: 'tree_traversal',
      algorithm: ir.algorithm,
      nodes: treeData.nodes || [],
      steps: ir.steps.map((step, idx) => ({
        step: idx + 1,
        // State data
        current: step.highlights?.current || step.state?.current || null,
        traversalOrder: step.state?.traversalOrder || [],
        stack: step.state?.stack || step.highlights?.stack || [],
        path: step.state?.path || step.highlights?.path || [],
        direction: step.state?.direction || step.highlights?.direction,
        inserted: step.highlights?.inserted,
        found: step.highlights?.found,
        notFound: step.highlights?.notFound,
        // Highlight data
        highlights: step.highlights || {},
        // Description
        description: step.meta?.description || ''
      })),
      // Keep new IR for enhanced features
      ir,
      // New metadata
      title: ir.title,
      complexity: ir.complexity,
      inputSchema: ir.inputs?.schema
    };
  }

  // Convert grid type
  if (ir.type === 'grid') {
    const gridData = ir.initial_state?.grid || ir.inputs?.values?.grid || {};
    return {
      type: 'grid',
      algorithm: ir.algorithm,
      grid: gridData,
      steps: ir.steps.map((step, idx) => ({
        step: idx + 1,
        // State data
        state: step.state || {},
        // Highlight data
        highlights: step.highlights || {},
        // Description
        description: step.meta?.description || ''
      })),
      // Keep new IR for enhanced features
      ir,
      // New metadata
      title: ir.title,
      complexity: ir.complexity,
      inputSchema: ir.inputs?.schema
    };
  }

  // For other types, return as-is with basic conversion
  return {
    type: ir.type,
    algorithm: ir.algorithm,
    steps: ir.steps?.map((step, idx) => ({
      step: idx + 1,
      ...step.state,
      highlights: step.highlights || {},
      highlight: step.highlights?.primary || [],
      description: step.meta?.description || ''
    })) || [],
    ir,
    title: ir.title,
    complexity: ir.complexity,
    inputSchema: ir.inputs?.schema
  };
}

// Export for backward compatibility (but prefer using backend detection)
export { detectSimulationTypeFallback as detectSimulationType };
