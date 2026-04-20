import { useState, useEffect, useCallback } from 'react';

/**
 * Detect simulation type from topic keywords
 */
function detectSimulationType(topic) {
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
    return 'array_sort';
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
    return 'graph_traversal';
  }

  // Tree algorithms
  if (
    lower.includes('tree') ||
    lower.includes('binary') ||
    lower.includes('bst') ||
    lower.includes('inorder') ||
    lower.includes('preorder') ||
    lower.includes('postorder') ||
    lower.includes('traversal')
  ) {
    return 'tree_traversal';
  }

  // Default to array_sort (most common)
  return 'array_sort';
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook for fetching and managing algorithm simulations
 * @param {string} topic - The algorithm topic to simulate
 * @param {object} options - Additional options
 * @returns {object} Simulation state and controls
 */
export default function useSimulation(topic, options = {}) {
  const { difficulty = 'beginner', autoFetch = true, accessToken = null } = options;

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const fetchSimulation = useCallback(async (overrideTopic) => {
    const targetTopic = overrideTopic || topic;
    if (!targetTopic) return;

    setLoading(true);
    setError(null);

    try {
      const simulationType = detectSimulationType(targetTopic);

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
          difficulty
        })
      });

      const data = await response.json();

      if (!data.success) {
        // Use fallback if provided
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
      console.error('[useSimulation] Error:', err);
      setError(err.message);
      setSimulation(null);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, accessToken]);

  // Auto-fetch when topic changes
  useEffect(() => {
    if (autoFetch && topic) {
      fetchSimulation();
    }
  }, [autoFetch, topic, fetchSimulation]);

  // Reset state when topic changes
  useEffect(() => {
    setSimulation(null);
    setError(null);
    setSource(null);
  }, [topic]);

  return {
    simulation,
    loading,
    error,
    source,
    refetch: fetchSimulation,
    // Helper to check if simulation is valid
    isValid: simulation && Array.isArray(simulation.steps) && simulation.steps.length > 0,
    // Computed values
    stepCount: simulation?.steps?.length || 0,
    simulationType: simulation?.type || detectSimulationType(topic || '')
  };
}

export { detectSimulationType };
