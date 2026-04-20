import { useState, useCallback, useRef, useEffect } from 'react';

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
 * Supports lazy loading by content type:
 * - learn: key_ideas, summary (Learn tab)
 * - examples: examples (Examples tab)
 * - flashcards-mindmap: flashcards + mind_map (Flashcards & Mind Map tabs)
 * - quiz: quiz questions (Quiz tab)
 */
export function useLearningContent() {
  // Per-tab content storage
  const [contentByTab, setContentByTab] = useState({
    learn: null,
    examples: null,
    flashcardsMindmap: null,
    quiz: null,
  });

  // Loading states per tab
  const [loadingTabs, setLoadingTabs] = useState({
    learn: false,
    examples: false,
    flashcardsMindmap: false,
    quiz: false,
  });

  // Track which tabs have been fetched
  const [fetchedTabs, setFetchedTabs] = useState(new Set());

  // Legacy combined content (for backward compatibility)
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // In-flight request tracking
  const inFlightRequestRef = useRef({});
  const lastQueryRef = useRef(null);

  /**
   * Fetch content for a specific tab (lazy loading)
   * @param {string} query - The learning topic
   * @param {string} tabType - One of: 'learn', 'examples', 'flashcards-mindmap', 'quiz'
   * @param {string} userId - User ID for personalization
   * @param {string} accessToken - Auth token
   * @param {object} preferences - User preferences { mode: 'simple'|'balanced'|'deep', style: 'story'|'visual'|'step-by-step' }
   */
  const fetchTabContent = useCallback(async (query, tabType, userId = null, accessToken = null, preferences = null) => {
    if (!query?.trim() || !tabType) return null;

    // Map tab types to state keys
    const tabKeyMap = {
      'learn': 'learn',
      'examples': 'examples',
      'flashcards-mindmap': 'flashcardsMindmap',
      'quiz': 'quiz',
    };

    const tabKey = tabKeyMap[tabType];
    if (!tabKey) {
      console.error(`Unknown tab type: ${tabType}`);
      return null;
    }

    // Guard: don't refetch if already fetched or loading
    if (fetchedTabs.has(tabType) || loadingTabs[tabKey]) {
      return contentByTab[tabKey];
    }

    // Return existing in-flight request
    if (inFlightRequestRef.current[tabType]) {
      return inFlightRequestRef.current[tabType];
    }

    setLoadingTabs(prev => ({ ...prev, [tabKey]: true }));
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
          body: JSON.stringify({ query, userId, contentType: tabType, preferences })
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

        // Store content for this tab
        setContentByTab(prev => ({ ...prev, [tabKey]: data.content }));
        setFetchedTabs(prev => new Set([...prev, tabType]));

        // Also update legacy combined content
        setContent(prev => ({
          ...prev,
          ...data.content,
        }));

        return data.content;
      } catch (err) {
        console.error(`Learning content error (${tabType}):`, err);
        setError(err.message);
        return null;
      } finally {
        delete inFlightRequestRef.current[tabType];
        setLoadingTabs(prev => ({ ...prev, [tabKey]: false }));
      }
    })();

    inFlightRequestRef.current[tabType] = requestPromise;
    return requestPromise;
  }, [fetchedTabs, loadingTabs, contentByTab]);

  /**
   * Generate all content at once (legacy behavior)
   * @param {string} query - The learning topic
   * @param {string} userId - User ID for personalization
   * @param {boolean} forceRefresh - Force refresh cached content
   * @param {string} accessToken - Auth token
   * @param {object} preferences - User preferences { mode: 'simple'|'balanced'|'deep', style: 'story'|'visual'|'step-by-step' }
   */
  const generateContent = useCallback(async (query, userId = null, forceRefresh = false, accessToken = null, preferences = null) => {
    if (!query?.trim()) return null;

    // If force refresh, clear all cached content
    if (forceRefresh) {
      setContentByTab({ learn: null, examples: null, flashcardsMindmap: null, quiz: null });
      setFetchedTabs(new Set());
      setContent(null);
    }

    // Store query for lazy loading
    lastQueryRef.current = query;

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
          body: JSON.stringify({ query, userId, forceRefresh, preferences })
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

        // Store all content
        setContent(data.content);

        // Also populate per-tab state
        setContentByTab({
          learn: {
            topic: data.content.topic,
            title: data.content.title,
            summary: data.content.summary,
            key_ideas: data.content.key_ideas,
            difficulty_level: data.content.difficulty_level,
            estimated_time: data.content.estimated_time,
            prerequisites: data.content.prerequisites,
            skill_areas: data.content.skill_areas,
            next_topics: data.content.next_topics,
          },
          examples: { examples: data.content.examples },
          flashcardsMindmap: {
            flashcards: data.content.flashcards,
            mind_map: data.content.mind_map,
          },
          quiz: { quiz: data.content.quiz },
        });

        // Mark all tabs as fetched
        setFetchedTabs(new Set(['learn', 'examples', 'flashcards-mindmap', 'quiz']));

        return data.content;
      } catch (err) {
        console.error('Learning content error:', err);
        setError(err.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    })();

    return requestPromise;
  }, []);

  /**
   * Helper to check if a tab has content loaded
   */
  const hasTabContent = useCallback((tabType) => {
    const tabKeyMap = {
      'learn': 'learn',
      'examples': 'examples',
      'flashcards-mindmap': 'flashcardsMindmap',
      'flashcards': 'flashcardsMindmap',
      'mindmap': 'flashcardsMindmap',
      'quiz': 'quiz',
    };
    const tabKey = tabKeyMap[tabType];
    return tabKey && contentByTab[tabKey] !== null;
  }, [contentByTab]);

  /**
   * Get content for a specific tab
   */
  const getTabContent = useCallback((tabType) => {
    const tabKeyMap = {
      'learn': 'learn',
      'examples': 'examples',
      'flashcards-mindmap': 'flashcardsMindmap',
      'flashcards': 'flashcardsMindmap',
      'mindmap': 'flashcardsMindmap',
      'quiz': 'quiz',
    };
    const tabKey = tabKeyMap[tabType];
    return tabKey ? contentByTab[tabKey] : null;
  }, [contentByTab]);

  /**
   * Check if a specific tab is loading
   */
  const isTabLoading = useCallback((tabType) => {
    const tabKeyMap = {
      'learn': 'learn',
      'examples': 'examples',
      'flashcards-mindmap': 'flashcardsMindmap',
      'flashcards': 'flashcardsMindmap',
      'mindmap': 'flashcardsMindmap',
      'quiz': 'quiz',
    };
    const tabKey = tabKeyMap[tabType];
    return tabKey ? loadingTabs[tabKey] : false;
  }, [loadingTabs]);

  const submitQuizAnswer = useCallback(async (questionId, selectedAnswer, correctAnswer, userId, accessToken = null, metadata = null) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/learning-content/quiz-answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          questionId,
          selectedAnswer,
          correctAnswer,
          userId,
          decisionId: metadata?.decisionId || null,
        })
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

  const regenerateBlock = useCallback(async (query, block, accessToken = null, preferences = null) => {
    if (!query?.trim() || !block) return null;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/learning-content/regenerate-block`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, block, preferences })
      });

      const data = await parseJsonResponse(
        response,
        'Block regeneration service is unavailable right now.',
      );

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to regenerate block');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to regenerate block');
      }

      return data.block;
    } catch (err) {
      console.error('Regenerate block error:', err);
      setError(err.message);
      return null;
    }
  }, []);

  const clearContent = useCallback(() => {
    setContent(null);
    setContentByTab({ learn: null, examples: null, flashcardsMindmap: null, quiz: null });
    setFetchedTabs(new Set());
    setError(null);
    lastQueryRef.current = null;
  }, []);

  return {
    // Legacy combined content
    content,
    isLoading,
    error,

    // Per-tab content
    contentByTab,
    loadingTabs,
    fetchedTabs,

    // Methods
    generateContent,
    fetchTabContent,
    hasTabContent,
    getTabContent,
    isTabLoading,
    submitQuizAnswer,
    trackInteraction,
    clearContent,
    regenerateBlock,

    // Store last query for lazy loading
    lastQuery: lastQueryRef.current,
  };
}

export default useLearningContent;
