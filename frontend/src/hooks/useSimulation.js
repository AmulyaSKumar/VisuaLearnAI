import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function buildAuthHeaders(accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export default function useSimulation(topic, options = {}) {
  const {
    detection = null,
    autoFetch = true,
    accessToken = null,
    conversationId = null,
    userId = null,
  } = options;

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [simulationId, setSimulationId] = useState(null);
  const [topicUnderstanding, setTopicUnderstanding] = useState(null);
  const [plan, setPlan] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [feedbackState, setFeedbackState] = useState({ type: null, pending: false, error: null });

  const fetchingRef = useRef(false);
  const lastFetchKeyRef = useRef(null);
  const previousTopicRef = useRef(topic);

  const fetchSimulation = useCallback(async (overrideTopic, overrides = {}) => {
    const targetTopic = (overrideTopic || topic || '').trim();
    if (!targetTopic) return null;

    const fetchKey = JSON.stringify({
      topic: targetTopic,
      conversationId,
      previousSimulationId: overrides.previousSimulationId || null,
      feedbackType: overrides.feedbackContext?.type || null,
    });

    if (fetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      return null;
    }

    fetchingRef.current = true;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/simulation/generate`, {
        method: 'POST',
        headers: buildAuthHeaders(accessToken),
        body: JSON.stringify({
          query: targetTopic,
          conversationId,
          userId,
          previousSimulationId: overrides.previousSimulationId || simulationId,
          feedbackContext: overrides.feedbackContext || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not load simulation.');
      }

      setSimulation(data.spec || null);
      setSimulationId(data.simulationId || null);
      setTopicUnderstanding(data.topicUnderstanding || null);
      setPlan(data.plan || null);
      setTelemetry(data.telemetry || null);
      setFallbackUsed(Boolean(data.fallbackUsed));
      setSource(data.fallbackUsed ? 'guided-fallback' : 'ai-generated');
      return data;
    } catch (err) {
      setError(err.message || 'Could not load simulation.');
      setSimulation(null);
      setSource(null);
      return null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [accessToken, conversationId, simulationId, topic, userId]);

  const submitFeedback = useCallback(async (type, score = null, reason = null) => {
    if (!simulationId) return null;

    setFeedbackState({ type, pending: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/simulation/feedback`, {
        method: 'POST',
        headers: buildAuthHeaders(accessToken),
        body: JSON.stringify({ simulationId, type, score, reason }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not save feedback.');
      }

      setFeedbackState({ type, pending: false, error: null });

      if (type === 'regenerate') {
        await fetchSimulation(topic, {
          previousSimulationId: simulationId,
          feedbackContext: { type, score, reason },
        });
      }

      return data;
    } catch (err) {
      setFeedbackState({ type, pending: false, error: err.message || 'Could not save feedback.' });
      return null;
    }
  }, [accessToken, fetchSimulation, simulationId, topic]);

  useEffect(() => {
    if (previousTopicRef.current !== topic) {
      previousTopicRef.current = topic;
      setSimulation(null);
      setError(null);
      setSource(null);
      setSimulationId(null);
      setTopicUnderstanding(null);
      setPlan(null);
      setTelemetry(null);
      setFallbackUsed(false);
      setFeedbackState({ type: null, pending: false, error: null });
      lastFetchKeyRef.current = null;
    }
  }, [topic]);

  useEffect(() => {
    if (!autoFetch || !topic || loading || fetchingRef.current) return;
    if (!detection) return;
    if (detection.supported === false) {
      setSimulation(null);
      setSource(null);
      setError(null);
      return;
    }
    fetchSimulation(topic);
  }, [autoFetch, detection, fetchSimulation, loading, topic]);

  const isValid = useMemo(() => (
    Boolean(
      simulation
      && Array.isArray(simulation.steps)
      && simulation.steps.length > 0
      && Array.isArray(simulation.primitives)
      && simulation.primitives.length > 0,
    )
  ), [simulation]);

  return {
    simulation,
    loading,
    error,
    source,
    refetch: fetchSimulation,
    isValid,
    stepCount: simulation?.steps?.length || 0,
    simulationType: simulation?.type || topicUnderstanding?.simulationType || detection?.simulationType || null,
    simulationId,
    topicUnderstanding,
    plan,
    telemetry,
    fallbackUsed,
    submitFeedback,
    feedbackState,
    detectionSource: detection ? 'backend' : null,
    detectionConfidence: detection?.confidence || null,
  };
}
