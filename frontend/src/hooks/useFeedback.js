import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = 'http://localhost:3001';

/**
 * Hook for submitting and managing feedback
 */
export function useFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState(null);
  const { user, session } = useAuth();

  /**
   * Submit feedback for a message
   * @param {string} type - thumbs_up | thumbs_down | correction | suggestion | report
   * @param {string} messageId - Optional message ID
   * @param {string} content - Optional feedback content
   * @param {object} metadata - Optional metadata (topic, widgetType, etc.)
   */
  const submitFeedback = useCallback(async (type, messageId = null, content = null, metadata = {}) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          userId: user?.id || null,
          type,
          messageId,
          content,
          metadata,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setLastFeedback({ type, timestamp: new Date() });
      return data.data;

    } catch (err) {
      console.error('Feedback error:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * Quick thumbs up
   */
  const thumbsUp = useCallback((messageId, metadata = {}) => {
    return submitFeedback('thumbs_up', messageId, null, metadata);
  }, [submitFeedback]);

  /**
   * Quick thumbs down
   */
  const thumbsDown = useCallback((messageId, metadata = {}) => {
    return submitFeedback('thumbs_down', messageId, null, metadata);
  }, [submitFeedback]);

  /**
   * Submit a correction
   */
  const submitCorrection = useCallback((messageId, correctionText, metadata = {}) => {
    return submitFeedback('correction', messageId, correctionText, metadata);
  }, [submitFeedback]);

  return {
    isSubmitting,
    lastFeedback,
    submitFeedback,
    thumbsUp,
    thumbsDown,
    submitCorrection,
  };
}

export default useFeedback;
