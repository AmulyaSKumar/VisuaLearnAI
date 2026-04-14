import { useState, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function parseJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();

  if (!rawText) {
    if (!response.ok) {
      throw new Error(fallbackMessage);
    }

    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Server returned invalid JSON. ${fallbackMessage}`);
  }
}

/**
 * Hook for fetching and managing learning content
 * Generates comprehensive learning materials: mindmaps, flashcards, quizzes, etc.
 */
export function useLearningContent() {
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlightRequestRef = useRef(null);
  const lastRequestKeyRef = useRef(null);

  const generateContent = useCallback(async (query, userId = null, forceRefresh = false, accessToken = null) => {
    if (!query?.trim()) return null;

    const requestKey = JSON.stringify({
      query: query.trim(),
      userId: userId || null,
      forceRefresh: Boolean(forceRefresh),
    });

    if (!forceRefresh && inFlightRequestRef.current && lastRequestKeyRef.current === requestKey) {
      return inFlightRequestRef.current;
    }

    lastRequestKeyRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const requestPromise = (async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(`${API_BASE}/api/learning-content`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, userId, forceRefresh })
        });

        const data = await parseJsonResponse(
          response,
          'Learning content service is unavailable right now.',
        );

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to generate content');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to generate content');
        }

        console.log('useLearningContent - API Response:', data);
        console.log('useLearningContent - Content from API:', data.content);

        setContent(data.content);
        return data.content;
      } catch (err) {
        console.error('Learning content error:', err);
        setError(err.message);
        return null;
      } finally {
        if (inFlightRequestRef.current === requestPromise) {
          inFlightRequestRef.current = null;
        }
        setIsLoading(false);
      }
    })();

    inFlightRequestRef.current = requestPromise;
    return requestPromise;
  }, []);

  const submitQuizAnswer = useCallback(async (questionId, selectedAnswer, correctAnswer, userId, accessToken = null) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/learning-content/quiz-answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionId, selectedAnswer, correctAnswer, userId })
      });

      const data = await parseJsonResponse(response, 'Quiz service is unavailable right now.');

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit quiz answer');
      }

      return data;
    } catch (err) {
      console.error('Quiz answer error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const trackInteraction = useCallback(async (userId, interactionType, data, accessToken = null) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/learning-content/track-interaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, interactionType, data })
      });

      if (!response.ok) {
        const payload = await parseJsonResponse(response, 'Failed to track learning interaction.');
        throw new Error(payload?.error || 'Failed to track learning interaction');
      }
    } catch (err) {
      console.error('Track interaction error:', err);
    }
  }, []);

  const clearContent = useCallback(() => {
    setContent(null);
    setError(null);
  }, []);

  return {
    content,
    isLoading,
    error,
    generateContent,
    submitQuizAnswer,
    trackInteraction,
    clearContent
  };
}

export default useLearningContent;
