/**
 * Learning Progress Hook
 * Fetches and manages user's learning progress from the API
 * @module hooks/useProgress
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

/**
 * Cognitive states for display
 */
export const CognitiveStateLabels = {
  mastering: { label: 'Mastering', color: 'text-green-600', bg: 'bg-green-100' },
  flow: { label: 'In Flow', color: 'text-neutral-600', bg: 'bg-neutral-100' },
  confused: { label: 'Needs Review', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  struggling: { label: 'Struggling', color: 'text-red-600', bg: 'bg-red-100' },
  bored: { label: 'Ready for More', color: 'text-neutral-600', bg: 'bg-neutral-100' },
};

/**
 * Custom hook for learning progress
 * @param {string} userId - Optional user ID (uses current user if not provided)
 * @returns {Object} Progress state and actions
 */
export function useProgress(userId = null) {
  const { user, getAccessToken, isAuthenticated } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const effectiveUserId = userId || user?.id;

  /**
   * Fetch user progress from API
   */
  const fetchProgress = useCallback(async (forceRefresh = false) => {
    if (!effectiveUserId || !isAuthenticated) {
      setProgress(null);
      setLoading(false);
      return;
    }

    // Skip if recently fetched (within 30 seconds) unless forced
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < 30000) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE}/api/progress/${effectiveUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No progress yet, set empty state
          setProgress({
            totalTopics: 0,
            masteredTopics: 0,
            strugglingTopics: 0,
            avgMastery: 0,
            totalTimeSeconds: 0,
            topics: [],
            recentSessions: [],
            topicsByState: {
              mastering: [],
              flow: [],
              confused: [],
              struggling: [],
              bored: [],
            },
          });
          setLastFetched(Date.now());
          return;
        }
        throw new Error(`Failed to fetch progress: ${response.statusText}`);
      }

      const data = await response.json();
      setProgress(data);
      setLastFetched(Date.now());
    } catch (err) {
      console.error('Error fetching progress:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, isAuthenticated, getAccessToken, lastFetched]);

  /**
   * Get topic progress
   */
  const getTopicProgress = useCallback((topic) => {
    if (!progress || !progress.topics) return null;

    return progress.topics.find(
      t => t.topic.toLowerCase() === topic.toLowerCase()
    );
  }, [progress]);

  /**
   * Get topics by cognitive state
   */
  const getTopicsByState = useCallback((state) => {
    if (!progress || !progress.topicsByState) return [];
    return progress.topicsByState[state] || [];
  }, [progress]);

  /**
   * Calculate overall stats
   */
  const getStats = useCallback(() => {
    if (!progress) {
      return {
        totalTopics: 0,
        masteredTopics: 0,
        inProgressTopics: 0,
        strugglingTopics: 0,
        completionRate: 0,
        totalTimeFormatted: '0m',
      };
    }

    const totalSeconds = progress.totalTimeSeconds || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalTimeFormatted = hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;

    return {
      totalTopics: progress.totalTopics || 0,
      masteredTopics: progress.masteredTopics || 0,
      inProgressTopics: (progress.topicsByState?.flow?.length || 0) +
                        (progress.topicsByState?.confused?.length || 0),
      strugglingTopics: progress.strugglingTopics || 0,
      completionRate: progress.totalTopics > 0
        ? Math.round((progress.masteredTopics / progress.totalTopics) * 100)
        : 0,
      avgMastery: Math.round((progress.avgMastery || 0) * 100),
      totalTimeFormatted,
    };
  }, [progress]);

  /**
   * Get recent sessions
   */
  const getRecentSessions = useCallback((limit = 5) => {
    if (!progress || !progress.recentSessions) return [];
    return progress.recentSessions.slice(0, limit);
  }, [progress]);

  /**
   * Get weak topics that need attention
   */
  const getWeakTopics = useCallback(() => {
    if (!progress) return [];

    return [
      ...(progress.topicsByState?.struggling || []),
      ...(progress.topicsByState?.confused || []),
    ].slice(0, 5);
  }, [progress]);

  /**
   * Get strong topics
   */
  const getStrongTopics = useCallback(() => {
    if (!progress) return [];

    return (progress.topicsByState?.mastering || []).slice(0, 5);
  }, [progress]);

  // Fetch progress on mount and when user changes
  useEffect(() => {
    fetchProgress();
  }, [effectiveUserId, isAuthenticated]);

  return {
    progress,
    loading,
    error,
    refresh: () => fetchProgress(true),
    getTopicProgress,
    getTopicsByState,
    getStats,
    getRecentSessions,
    getWeakTopics,
    getStrongTopics,
    CognitiveStateLabels,
  };
}

export default useProgress;
