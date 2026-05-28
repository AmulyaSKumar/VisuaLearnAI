import { useState, useEffect } from "react";

/**
 * SessionSummary - Modal shown after a learning session
 * Displays cognitive states encountered, improvement trend, and next steps
 */
export default function SessionSummary({
  isOpen,
  onClose,
  sessionData = {},
  userId,
}) {
  const [metrics, setMetrics] = useState(null);

  const {
    messagesCount = 0,
    widgetsViewed = 0,
    cognitiveStates = [],
    topics = [],
    duration = 0,
  } = sessionData;

  // Fetch latest metrics when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetch(`http://localhost:3001/api/user/${userId}/metrics`)
        .then(res => res.json())
        .then(data => setMetrics(data))
        .catch(err => console.error("Failed to fetch metrics:", err));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // Calculate state distribution
  const stateDistribution = cognitiveStates.reduce((acc, state) => {
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  const stateConfig = {
    struggling: { label: "Struggling", color: "bg-red-100 text-red-700" },
    confused: { label: "Confused", color: "bg-orange-100 text-orange-700" },
    flow: { label: "In Flow", color: "bg-green-100 text-green-700" },
    bored: { label: "Bored", color: "bg-yellow-100 text-yellow-700" },
    mastering: { label: "Mastering", color: "bg-neutral-100 text-neutral-700" },
  };

  // Determine dominant state
  const dominantState = Object.entries(stateDistribution)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "flow";

  // Generate recommendation based on session
  const getRecommendation = () => {
    if (dominantState === "struggling" || dominantState === "confused") {
      return {
        text: "Consider reviewing foundational concepts before moving forward.",
        action: "Practice basics",
      };
    }
    if (dominantState === "bored") {
      return {
        text: "You're ready for more challenging content!",
        action: "Try advanced topics",
      };
    }
    if (dominantState === "mastering") {
      return {
        text: "Excellent progress! Consider teaching others or exploring related topics.",
        action: "Explore new areas",
      };
    }
    return {
      text: "Great learning session! Keep up the momentum.",
      action: "Continue learning",
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl"></span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Session Summary</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDuration(duration)} of learning
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{messagesCount}</p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{widgetsViewed}</p>
              <p className="text-xs text-muted-foreground">Widgets</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{topics.length}</p>
              <p className="text-xs text-muted-foreground">Topics</p>
            </div>
          </div>

          {/* Cognitive States */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <span></span> Learning States
            </h3>
            <div className="space-y-2">
              {Object.entries(stateDistribution).map(([state, count]) => {
                const config = stateConfig[state] || { label: state, color: "bg-gray-100 text-gray-700" };
                const percent = Math.round((count / cognitiveStates.length) * 100);

                return (
                  <div key={state} className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium ${config.color}`}>
                      <span>{config.label}</span>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Topics Covered */}
          {topics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <span></span> Topics Covered
              </h3>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-muted rounded-lg text-xs font-medium text-foreground"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Trend */}
          {metrics && (
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Improvement Trend</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  metrics.improvement?.followUpTrend === "improving"
                    ? "bg-green-100 text-green-700"
                    : metrics.improvement?.followUpTrend === "declining"
                      ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {metrics.improvement?.followUpTrend === "improving" ? "↑ Improving" :
                   metrics.improvement?.followUpTrend === "declining" ? "↓ Declining" : "→ Stable"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${metrics.improvement?.score || 50}%` }}
                />
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">Recommended Next Step</h4>
                <p className="text-sm text-muted-foreground">{recommendation.text}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function
function formatDuration(ms) {
  if (!ms) return "0 min";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}
