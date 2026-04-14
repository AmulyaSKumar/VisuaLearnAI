import { useState, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:3001';

/**
 * Hook for streaming assets (widgets, images, fact-checks) from the backend
 */
export function useAssetStream() {
  const [assets, setAssets] = useState({
    widgets: [],
    images: [],
    factCheck: null,
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * Start streaming assets for a learning plan
   * @param {object} plan - The learning plan
   * @param {string} learningStyle - User's learning style (visual, auditory, etc.)
   */
  const startAssetStream = useCallback(async (plan, learningStyle = 'visual') => {
    // Reset state
    setAssets({ widgets: [], images: [], factCheck: null });
    setIsStreaming(true);
    setProgress('Starting asset generation...');
    setError(null);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/api/generate-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, learningStyle }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start asset generation');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

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

            switch (data.type) {
              case 'start':
                setProgress(`Generating assets for: ${data.plan}`);
                break;

              case 'asset':
                // Widget received
                setAssets(prev => ({
                  ...prev,
                  widgets: [...prev.widgets, data.asset],
                }));
                setProgress(data.progress);
                break;

              case 'image':
                // Image received
                setAssets(prev => ({
                  ...prev,
                  images: [...prev.images, data.asset],
                }));
                setProgress(data.progress);
                break;

              case 'fact_check':
                // Fact check received
                setAssets(prev => ({
                  ...prev,
                  factCheck: data.verification,
                }));
                setProgress(data.progress);
                break;

              case 'complete':
                setProgress(`Complete: ${data.message}`);
                break;

              case 'error':
                console.error('Asset error:', data.error);
                setError(data.error);
                break;

              case 'done':
                setIsStreaming(false);
                setProgress(null);
                break;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setProgress('Generation cancelled');
      } else {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  /**
   * Stop the current asset stream
   */
  const stopAssetStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  /**
   * Clear all assets
   */
  const clearAssets = useCallback(() => {
    setAssets({ widgets: [], images: [], factCheck: null });
    setProgress(null);
    setError(null);
  }, []);

  return {
    assets,
    isStreaming,
    progress,
    error,
    startAssetStream,
    stopAssetStream,
    clearAssets,
  };
}

export default useAssetStream;
