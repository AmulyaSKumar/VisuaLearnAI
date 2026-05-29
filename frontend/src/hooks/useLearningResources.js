import { useState, useCallback, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

/**
 * Resource types matching backend
 */
export const RESOURCE_TYPES = {
  LEARN: 'learn',
  SIMULATION: 'simulation',
  FLASHCARDS: 'flashcards',
  MINDMAP: 'mindmap',
  QUIZ: 'quiz',
};

/**
 * Tab configuration for each resource type
 */
export const TAB_CONFIG = {
  [RESOURCE_TYPES.LEARN]: {
    label: 'Learn',
    order: 0,
    alwaysShow: true, // Learn tab is always visible
  },
  [RESOURCE_TYPES.SIMULATION]: {
    label: 'Simulation',
    order: 1,
    alwaysShow: false,
  },
  [RESOURCE_TYPES.FLASHCARDS]: {
    label: 'Flashcards',
    order: 2,
    alwaysShow: false,
  },
  [RESOURCE_TYPES.MINDMAP]: {
    label: 'Mind Map',
    order: 3,
    alwaysShow: false,
  },
  [RESOURCE_TYPES.QUIZ]: {
    label: 'Quiz',
    order: 4,
    alwaysShow: false,
  },
};

/**
 * Hook for managing learning resources with persistence
 * @param {string} conversationId - Current conversation ID
 * @param {string} accessToken - JWT access token
 */
export function useLearningResources(conversationId, accessToken) {
  const [resources, setResources] = useState({});
  const [availableTypes, setAvailableTypes] = useState(['learn']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  /**
   * Fetch all resources for the conversation
   */
  const fetchResources = useCallback(async () => {
    if (!conversationId || !accessToken) {
      console.log('[useLearningResources] Skipping fetch - missing conversationId or accessToken');
      return;
    }

    console.log('[useLearningResources] Fetching resources for conversation:', conversationId.slice(0, 8));
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/resources/${conversationId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useLearningResources] API error:', response.status, errorText);
        // Don't throw for 404 or 500 - table might not exist yet
        if (response.status === 500) {
          console.warn('[useLearningResources] Server error - learning_resources table may not exist. Run migration.');
          setResources({});
          setAvailableTypes(['learn']);
          return;
        }
        throw new Error('Failed to fetch resources');
      }

      const data = await response.json();

      // Convert grouped resources to flat map
      const resourceMap = {};
      Object.entries(data.resources || {}).forEach(([type, items]) => {
        // Use the most recent resource for each type
        if (items && items.length > 0) {
          resourceMap[type] = items[items.length - 1];
        }
      });

      setResources(resourceMap);
      setAvailableTypes(data.types || ['learn']);

      console.log('[useLearningResources] Fetched resources:', {
        conversationId: conversationId.slice(0, 8),
        types: data.types,
        resourceCount: Object.keys(resourceMap).length,
        resourceTypes: Object.keys(resourceMap),
      });
    } catch (err) {
      console.error('[useLearningResources] Fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, accessToken]);

  /**
   * Get a specific resource by type
   */
  const getResource = useCallback((type) => {
    return resources[type] || null;
  }, [resources]);

  /**
   * Check if a resource type is available
   */
  const hasResource = useCallback((type) => {
    return availableTypes.includes(type) && !!resources[type];
  }, [availableTypes, resources]);

  /**
   * Save a resource (called after generation)
   */
  const saveResource = useCallback(async (type, topic, content, messageId = null) => {
    if (!conversationId || !accessToken) return null;

    try {
      const response = await fetch(
        `${API_BASE}/api/resources/${conversationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            resourceType: type,
            topic,
            content,
            messageId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save resource');
      }

      const saved = await response.json();

      // Update local state
      setResources(prev => ({
        ...prev,
        [type]: {
          id: saved.id,
          topic: saved.topic,
          content: saved.content,
          createdAt: saved.createdAt,
        },
      }));

      // Add type to available types if not already present
      setAvailableTypes(prev => {
        if (!prev.includes(type)) {
          return [...prev, type];
        }
        return prev;
      });

      console.log('[useLearningResources] Saved resource:', { type, id: saved.id });
      return saved;
    } catch (err) {
      console.error('[useLearningResources] Save error:', err);
      return null;
    }
  }, [conversationId, accessToken]);

  /**
   * Add a resource type to available types (for UI tab rendering)
   * Used when simulation detection or user request adds a tab
   */
  const addAvailableType = useCallback((type) => {
    setAvailableTypes(prev => {
      if (!prev.includes(type)) {
        return [...prev, type].sort((a, b) =>
          (TAB_CONFIG[a]?.order || 99) - (TAB_CONFIG[b]?.order || 99)
        );
      }
      return prev;
    });
  }, []);

  /**
   * Update resource content locally (without saving to backend)
   * Used when content is generated but not yet saved
   */
  const updateResourceLocally = useCallback((type, content) => {
    setResources(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        content,
        updatedLocally: true,
      },
    }));
  }, []);

  /**
   * Get tabs to render based on available resources
   */
  const getTabs = useCallback(() => {
    const tabs = [];

    // Always add Learn tab first
    tabs.push({
      type: RESOURCE_TYPES.LEARN,
      ...TAB_CONFIG[RESOURCE_TYPES.LEARN],
      hasContent: !!resources[RESOURCE_TYPES.LEARN],
    });

    // Add other tabs based on available types
    availableTypes.forEach(type => {
      if (type !== RESOURCE_TYPES.LEARN && TAB_CONFIG[type]) {
        tabs.push({
          type,
          ...TAB_CONFIG[type],
          hasContent: !!resources[type],
        });
      }
    });

    // Sort by order
    return tabs.sort((a, b) => a.order - b.order);
  }, [availableTypes, resources]);

  /**
   * Track previous conversationId to detect changes
   */
  const prevConversationIdRef = useRef(null);

  /**
   * Combined effect: Reset and fetch when conversation changes
   * This fixes the race condition between separate reset/fetch effects
   */
  useEffect(() => {
    // Detect if conversation actually changed (not just initial mount)
    const conversationChanged = prevConversationIdRef.current !== conversationId;
    prevConversationIdRef.current = conversationId;

    // If conversation changed, reset state first
    if (conversationChanged) {
      console.log('[useLearningResources] Conversation changed, resetting state');
      setResources({});
      setAvailableTypes(['learn']);
      setError(null);
      fetchedRef.current = false;
    }

    // Then fetch if we have valid params and haven't fetched yet
    if (conversationId && accessToken && !fetchedRef.current) {
      console.log('[useLearningResources] Triggering fetch for:', conversationId.slice(0, 8));
      fetchedRef.current = true;
      fetchResources();
    }
  }, [conversationId, accessToken, fetchResources]);

  return {
    // State
    resources,
    availableTypes,
    isLoading,
    error,

    // Actions
    fetchResources,
    getResource,
    hasResource,
    saveResource,
    addAvailableType,
    updateResourceLocally,

    // Tab helpers
    getTabs,
    TAB_CONFIG,
    RESOURCE_TYPES,
  };
}

export default useLearningResources;
