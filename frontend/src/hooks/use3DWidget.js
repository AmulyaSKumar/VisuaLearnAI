import { useState, useCallback, useRef } from 'react';
import { should3DVisualize, getDeviceCapabilities, extract3DTopic } from '../utils/detect3D';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook for generating 3D widgets separately from chat
 * @param {string} accessToken - JWT access token for API authentication
 */
export function use3DWidget(accessToken = null) {
  const [widget, setWidget] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skipReason, setSkipReason] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * Generate 3D widget for a topic
   * @param {string} query - Original user query
   * @param {string} context - Assistant's text response (for context)
   * @returns {Promise<Object|null>} Widget object or null if skipped
   */
  const generate3D = useCallback(async (query, context = '') => {
    // Reset state
    setSkipReason(null);
    setError(null);

    // Check if 3D is appropriate (frontend check)
    const detection = should3DVisualize(query);
    if (!detection.use3D) {
      const reason = `Frontend: ${detection.reason || 'Not appropriate for 3D'} (score: ${detection.score})`;
      console.log('[use3DWidget] Skipping -', reason);
      setSkipReason(reason);
      return null;
    }

    // Check device capabilities
    const capabilities = getDeviceCapabilities();
    if (!capabilities.canRender3D) {
      const reason = 'Device cannot render 3D (WebGL not supported)';
      console.log('[use3DWidget] Skipping -', reason);
      setSkipReason(reason);
      return null;
    }

    // Extract topic for display purposes (but send original query to backend)
    const topic = extract3DTopic(query);
    console.log('[use3DWidget] Starting API call:', { query: query.slice(0, 50), topic });

    setIsLoading(true);
    setWidget(null);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Send BOTH query (for detection) and topic (for generation focus)
      const response = await fetch(`${API_BASE}/api/generate-3d`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,  // Original query for detection
          topic,  // Extracted topic for generation focus
          context: context.slice(0, 1000),
          deviceCapabilities: capabilities,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start 3D generation');
      }

      // Check if response is JSON (skip response) or SSE stream
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.skip) {
          const reason = `Backend: ${data.reason || 'Skipped'} (score: ${data.score || 'N/A'})`;
          console.log('[use3DWidget] Backend skipped -', reason);
          setSkipReason(reason);
          setIsLoading(false);
          return null;
        }
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let resultWidget = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'skip') {
              const reason = `Backend SSE: ${data.reason || 'Skipped during generation'}`;
              console.log('[use3DWidget] Stream skipped -', reason);
              setSkipReason(reason);
              setIsLoading(false);
              return null;
            }

            if (data.type === 'error') {
              const reason = `Backend error: ${data.error || 'Unknown error'}`;
              console.warn('[use3DWidget] Stream error -', reason);
              setSkipReason(reason);
              setError(data.error);
              setIsLoading(false);
              return null;
            }

            if (data.type === 'complete' && data.widget) {
              resultWidget = data.widget;
              console.log('[use3DWidget] ✓ Widget received from API:', {
                id: resultWidget.id,
                title: resultWidget.title,
                codeLength: resultWidget.code?.length || 0,
              });
            }

            if (data.type === 'done') {
              setWidget(resultWidget);
              setIsLoading(false);
              console.log('[use3DWidget] Stream complete');
              return resultWidget;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      setIsLoading(false);
      return resultWidget;

    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        setSkipReason('Request cancelled');
        return null;
      }

      const reason = `Network error: ${err.message}`;
      console.warn('[use3DWidget] Fetch failed -', reason);
      setSkipReason(reason);
      setError(err.message);
      setIsLoading(false);
      return null;
    }
  }, [accessToken]);

  /**
   * Cancel ongoing 3D generation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * Clear current widget
   */
  const clear = useCallback(() => {
    setWidget(null);
    setError(null);
  }, []);

  return {
    widget,
    isLoading,
    error,
    skipReason,  // Expose why 3D was skipped (or null if not skipped)
    generate3D,
    cancel,
    clear,
  };
}

export default use3DWidget;
