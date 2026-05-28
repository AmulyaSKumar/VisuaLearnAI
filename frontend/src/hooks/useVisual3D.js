import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function normalizeResult(data) {
  if (!data?.success || !data?.blueprint) {
    return {
      available: false,
      blueprint: null,
      validation: data?.validation || null,
      error: data?.error || data?.validation?.errors?.[0] || '3D is not available for this topic.',
    };
  }

  return {
    available: true,
    blueprint: data.blueprint,
    validation: data.validation || data.blueprint?.validation || null,
    error: null,
  };
}

export default function useVisual3D(topic, options = {}) {
  const {
    accessToken = null,
    autoFetch = true,
    initialVisual3D = null,
  } = options;

  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState(initialVisual3D?.blueprint || null);
  const [validation, setValidation] = useState(initialVisual3D?.validation || initialVisual3D?.blueprint?.validation || null);
  const [error, setError] = useState(initialVisual3D?.error || null);
  const [available, setAvailable] = useState(Boolean(initialVisual3D?.blueprint));

  const topicKey = useMemo(() => String(topic || '').trim(), [topic]);

  const fetchVisual3D = useCallback(async (overrideTopic = topicKey) => {
    const requestedTopic = String(overrideTopic || '').trim();
    if (!requestedTopic) {
      setAvailable(false);
      setError('3D is not available for this topic.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch(`${API_BASE}/api/visual3d/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic: requestedTopic }),
      });

      const data = await response.json().catch(() => null);
      const normalized = normalizeResult(data || {});

      setBlueprint(normalized.blueprint);
      setValidation(normalized.validation);
      setAvailable(normalized.available);
      setError(normalized.error);

      return normalized.available
        ? { topic: requestedTopic, blueprint: normalized.blueprint, validation: normalized.validation }
        : null;
    } catch (err) {
      setBlueprint(null);
      setValidation(null);
      setAvailable(false);
      setError(err?.message || '3D is not available for this topic.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accessToken, topicKey]);

  useEffect(() => {
    if (!initialVisual3D?.blueprint) return;
    setBlueprint(initialVisual3D.blueprint);
    setValidation(initialVisual3D.validation || initialVisual3D.blueprint?.validation || null);
    setAvailable(true);
    setError(null);
  }, [initialVisual3D]);

  useEffect(() => {
    if (!autoFetch || initialVisual3D?.blueprint || !topicKey) return;
    fetchVisual3D(topicKey);
  }, [autoFetch, fetchVisual3D, initialVisual3D?.blueprint, topicKey]);

  return {
    loading,
    blueprint,
    validation,
    error,
    available,
    refetch: fetchVisual3D,
  };
}
