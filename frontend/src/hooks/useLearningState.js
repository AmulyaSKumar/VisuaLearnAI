import { useState, useCallback, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://visualearnai-backend.onrender.com" : "http://localhost:3001");

/**
 * useLearningState - Manages real-time learning state synchronization
 * Fetches and updates user profile, metrics, and cognitive state
 */
export function useLearningState(userId, accessToken = null) {
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [cognitiveState, setCognitiveState] = useState("flow");
  const [currentTopic, setCurrentTopic] = useState(null);
  const [strategy, setStrategy] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch user profile
  const fetchProfile = useCallback(async () => {
    if (!userId || !accessToken) return null;

    try {
      const response = await fetch(`${API_BASE}/api/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
    return null;
  }, [accessToken, userId]);

  // Fetch user metrics
  const fetchMetrics = useCallback(async () => {
    if (!userId || !accessToken) return null;

    try {
      const response = await fetch(`${API_BASE}/api/user/${userId}/metrics`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    }
    return null;
  }, [accessToken, userId]);

  // Refresh all learning state data
  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchProfile(), fetchMetrics()]);
      setLastUpdated(Date.now());
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, fetchMetrics]);

  // Update state from personalization metadata (from SSE stream)
  const updateFromPersonalizationMeta = useCallback((meta) => {
    if (!meta) return;

    if (meta.cognitiveState) {
      setCognitiveState(meta.cognitiveState);
    }
    if (meta.topic) {
      setCurrentTopic(meta.topic);
    }
    if (meta.strategy) {
      setStrategy(meta.strategy);
    }
    if (meta.explanation?.debugInfo?.profile) {
      // Update profile from explanation debug info if available
      const { dominantStyle, stylePercent, knowledgeLevel, confidenceScore } = meta.explanation.debugInfo.profile;
      setProfile(prev => ({
        ...prev,
        dominant_style: dominantStyle,
        confidence_score: confidenceScore,
        comprehension_level: knowledgeLevel,
      }));
    }
  }, []);

  // Update cognitive state
  const updateCognitiveState = useCallback((state) => {
    const validStates = ["struggling", "confused", "flow", "bored", "mastering"];
    if (validStates.includes(state)) {
      setCognitiveState(state);
    }
  }, []);

  // Update current topic
  const updateCurrentTopic = useCallback((topic) => {
    setCurrentTopic(topic);
  }, []);

  // Update strategy
  const updateStrategy = useCallback((newStrategy) => {
    setStrategy(prev => ({ ...prev, ...newStrategy }));
  }, []);

  // Get combined state for components
  const getLearningState = useCallback(() => {
    return {
      profile,
      metrics,
      cognitiveState,
      currentTopic,
      strategy,
      learningStyle: profile?.detected_styles || {},
      confidenceScore: profile?.confidence_score || 0.5,
      weakTopics: profile?.weak_topics || [],
      strongTopics: profile?.strong_topics || [],
      knowledgeLevel: profile?.comprehension_level || "intermediate",
      isLoading,
      lastUpdated,
    };
  }, [profile, metrics, cognitiveState, currentTopic, strategy, isLoading, lastUpdated]);

  // Check if user needs onboarding
  const needsOnboarding = useCallback(() => {
    if (!profile) return null; // Unknown yet
    return !profile.onboarding_completed && !profile.learning_style;
  }, [profile]);

  // Initial fetch on mount
  useEffect(() => {
    if (userId && accessToken) {
      refreshState();
    }
  }, [accessToken, userId, refreshState]);

  return {
    // State
    profile,
    metrics,
    cognitiveState,
    currentTopic,
    strategy,
    isLoading,
    lastUpdated,

    // Computed
    learningStyle: profile?.detected_styles || {},
    confidenceScore: profile?.confidence_score || 0.5,
    weakTopics: profile?.weak_topics || [],
    strongTopics: profile?.strong_topics || [],

    // Actions
    fetchProfile,
    fetchMetrics,
    refreshState,
    updateFromPersonalizationMeta,
    updateCognitiveState,
    updateCurrentTopic,
    updateStrategy,
    getLearningState,
    needsOnboarding,
  };
}
