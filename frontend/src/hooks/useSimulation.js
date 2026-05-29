import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');
const SIMULATION_TIMEOUT_MS = 15000;
const simulationResultCache = new Map();
const simulationRequestCache = new Map();

function buildAuthHeaders(accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function normalizeSimulationResult(data) {
  return data?.final || data?.spec || data?.bundle || null;
}

function detectionSignature(detection) {
  if (!detection) return 'none';
  return JSON.stringify({
    supported: detection.supported,
    topic: detection.topic,
    family: detection.family,
    domain: detection.domain,
    simulationType: detection.simulationType,
    confidence: detection.confidence,
    activeTopic: detection.decision?.activeTopic,
    needed: detection.decision?.simulation?.needed,
    explicit: detection.decision?.simulation?.explicit,
  });
}

function sourceFor(data) {
  const final = normalizeSimulationResult(data);
  if (final?.type === 'sandbox_simulation') return 'sandbox-engine';
  return 'invalid';
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

  const fetchingRef = useRef(false);
  const lastFetchKeyRef = useRef(null);
  const previousTopicRef = useRef(topic);
  const detectionRef = useRef(detection);
  const mountedRef = useRef(true);
  const detectionKey = useMemo(() => detectionSignature(detection), [detection]);

  useEffect(() => {
    detectionRef.current = detection;
  }, [detectionKey, detection]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const applyResult = useCallback((data) => {
    const final = normalizeSimulationResult(data);
    if (!mountedRef.current) return;
    setSimulation(final);
    setSimulationId(data?.simulationId || data?.id || null);
    setTopicUnderstanding(data?.topicUnderstanding || data?.plannerOutput?.topicUnderstanding || null);
    setPlan(data?.plan || data?.plannerOutput || null);
    setTelemetry(data?.telemetry || null);
    setFallbackUsed(Boolean(data?.fallbackUsed));
    setSource(sourceFor(data));
  }, []);

  const fetchSimulation = useCallback(async (overrideTopic, overrides = {}) => {
    const targetTopic = (overrideTopic || topic || '').trim();
    if (!targetTopic) return null;

    const fetchKey = JSON.stringify({
      topic: targetTopic,
      conversationId,
      userId,
      feedbackType: overrides.feedbackContext?.type || null,
      detection: detectionKey,
    });

    if (fetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      return null;
    }

    if (!overrides.feedbackContext && simulationResultCache.has(fetchKey)) {
      const cached = simulationResultCache.get(fetchKey);
      applyResult(cached);
      return cached;
    }

    fetchingRef.current = true;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SIMULATION_TIMEOUT_MS);

    try {
      const requestPromise = simulationRequestCache.get(fetchKey) || (async () => {
        const activeDetection = detectionRef.current;
        const response = await fetch(`${API_BASE}/api/simulation/generate`, {
          method: 'POST',
          headers: buildAuthHeaders(accessToken),
          signal: controller.signal,
          body: JSON.stringify({
            query: targetTopic,
            conversationId,
            userId,
            decision: activeDetection?.decision || null,
            options: {
              useLlm: overrides.useLlm ?? false,
              conversationId,
              userId,
              feedbackContext: overrides.feedbackContext || null,
              decision: activeDetection?.decision || null,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Could not load simulation.');
        }
        simulationResultCache.set(fetchKey, data);
        return data;
      })();

      simulationRequestCache.set(fetchKey, requestPromise);
      const data = await requestPromise;
      const final = normalizeSimulationResult(data);
      if (final?.type !== 'sandbox_simulation') {
        throw new Error('Simulation engine returned a non-sandbox result.');
      }
      applyResult(data);
      return data;
    } catch (err) {
      const message = err.name === 'AbortError'
        ? 'Simulation generation timed out.'
        : err.message || 'Could not load simulation.';
      if (mountedRef.current) {
        setError(message);
        setSimulation(null);
        setSource(null);
      }
      return null;
    } finally {
      simulationRequestCache.delete(fetchKey);
      window.clearTimeout(timeout);
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [accessToken, applyResult, conversationId, detectionKey, topic, userId]);

  const submitFeedback = useCallback(async () => ({ success: true, stored: false }), []);

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
      lastFetchKeyRef.current = null;
    }
  }, [topic]);

  useEffect(() => {
    if (!autoFetch || !topic || loading || fetchingRef.current) return;
    const activeDetection = detectionRef.current;
    if (!activeDetection) return;
    if (activeDetection.supported === false) {
      setSimulation(null);
      setSource(null);
      setError(null);
      return;
    }
    fetchSimulation(topic);
  }, [autoFetch, detectionKey, fetchSimulation, loading, topic]);

  const isValid = useMemo(() => (
    Boolean(
      simulation
      && simulation.type === 'sandbox_simulation',
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
    simulationType: simulation?.type || simulation?.spec_type || topicUnderstanding?.simulationType || detection?.simulationType || null,
    simulationId,
    topicUnderstanding,
    plan,
    telemetry,
    fallbackUsed,
    scene3d: null,
    submitFeedback,
    feedbackState: { type: null, pending: false, error: null },
    detectionSource: detection ? 'backend' : null,
    detectionConfidence: detection?.confidence || null,
  };
}
