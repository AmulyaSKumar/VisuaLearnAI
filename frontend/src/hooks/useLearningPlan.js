import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

/**
 * Hook for generating and managing learning plans
 */
export function useLearningPlan() {
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate a learning plan from a goal
   */
  const generatePlan = useCallback(async (goal, userId = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, userId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate plan');
      }

      setPlan(data.data.plan);
      return data.data.plan;

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear the current plan
   */
  const clearPlan = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  return {
    plan,
    isLoading,
    error,
    generatePlan,
    clearPlan,
  };
}

export default useLearningPlan;
