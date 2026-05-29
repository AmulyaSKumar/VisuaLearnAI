import { useRef, useCallback, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://visualearnai-backend.onrender.com" : "http://localhost:3001");

/**
 * useBehaviorTracking - Tracks user behavior for personalization
 * Monitors: widget clicks, time spent per message, follow-up frequency
 */
export function useBehaviorTracking(userId) {
  const behaviorRef = useRef({
    sessionStart: Date.now(),
    messageViews: [], // { messageId, startTime, duration }
    widgetInteractions: [], // { widgetId, action, timestamp }
    followUps: [], // timestamps of follow-up messages
    lastMessageTime: null,
    totalInteractions: 0,
  });

  const currentMessageRef = useRef(null);

  // Track when user starts viewing a message
  const startMessageView = useCallback((messageId) => {
    currentMessageRef.current = {
      messageId,
      startTime: Date.now(),
    };
  }, []);

  // Track when user stops viewing a message (e.g., scrolls away or sends new message)
  const endMessageView = useCallback(() => {
    if (currentMessageRef.current) {
      const duration = Date.now() - currentMessageRef.current.startTime;
      behaviorRef.current.messageViews.push({
        ...currentMessageRef.current,
        duration,
      });
      currentMessageRef.current = null;
    }
  }, []);

  // Track widget interactions
  const trackWidgetInteraction = useCallback((widgetId, action, data = {}) => {
    behaviorRef.current.widgetInteractions.push({
      widgetId,
      action,
      data,
      timestamp: Date.now(),
    });
    behaviorRef.current.totalInteractions++;
  }, []);

  // Track follow-up messages (messages sent within 60 seconds)
  const trackFollowUp = useCallback(() => {
    const now = Date.now();
    const { lastMessageTime } = behaviorRef.current;

    if (lastMessageTime && (now - lastMessageTime) < 60000) {
      behaviorRef.current.followUps.push(now);
    }
    behaviorRef.current.lastMessageTime = now;
  }, []);

  // Get aggregated behavior data
  const getBehaviorData = useCallback(() => {
    const behavior = behaviorRef.current;
    const sessionDuration = Date.now() - behavior.sessionStart;

    // Calculate average message view duration
    const avgMessageDuration = behavior.messageViews.length > 0
      ? behavior.messageViews.reduce((sum, v) => sum + v.duration, 0) / behavior.messageViews.length
      : 0;

    // Calculate follow-up frequency (per minute)
    const sessionMinutes = sessionDuration / 60000;
    const followUpFrequency = sessionMinutes > 0
      ? behavior.followUps.length / sessionMinutes
      : 0;

    return {
      sessionDuration,
      messageViewCount: behavior.messageViews.length,
      avgMessageDuration,
      widgetInteractionCount: behavior.widgetInteractions.length,
      followUpCount: behavior.followUps.length,
      followUpFrequency,
      totalInteractions: behavior.totalInteractions,
    };
  }, []);

  // Send behavior data to server
  const sendBehaviorData = useCallback(async () => {
    if (!userId) return;

    const data = getBehaviorData();

    try {
      await fetch(`${API_BASE}/api/behavior`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          ...data,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Failed to send behavior data:", err);
    }
  }, [userId, getBehaviorData]);

  // Get session summary data for SessionSummary modal
  const getSessionSummary = useCallback(() => {
    const behavior = behaviorRef.current;
    return {
      duration: Date.now() - behavior.sessionStart,
      messagesCount: behavior.messageViews.length,
      widgetsViewed: behavior.widgetInteractions.filter(w => w.action === 'view').length,
      totalInteractions: behavior.totalInteractions,
    };
  }, []);

  // Reset session
  const resetSession = useCallback(() => {
    behaviorRef.current = {
      sessionStart: Date.now(),
      messageViews: [],
      widgetInteractions: [],
      followUps: [],
      lastMessageTime: null,
      totalInteractions: 0,
    };
  }, []);

  // Send behavior data periodically (every 5 minutes) and on unmount
  useEffect(() => {
    const interval = setInterval(() => {
      sendBehaviorData();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      sendBehaviorData(); // Send on unmount
    };
  }, [sendBehaviorData]);

  return {
    startMessageView,
    endMessageView,
    trackWidgetInteraction,
    trackFollowUp,
    getBehaviorData,
    getSessionSummary,
    sendBehaviorData,
    resetSession,
  };
}
