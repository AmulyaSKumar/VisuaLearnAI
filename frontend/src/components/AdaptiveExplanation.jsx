import { useState } from "react";

/**
 * AdaptiveExplanation - Displays why a response was personalized
 * Toggle mode: collapsed by default, expands to show full explanation
 */
export default function AdaptiveExplanation({ explanation, cognitiveState, topic, strategy }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!explanation) return null;

  const { summary, factors = [], debugInfo } = explanation;

  // State colors and icons
  const stateConfig = {
    struggling: { color: "text-red-600", bgColor: "bg-red-50", icon: "🔴" },
    confused: { color: "text-orange-600", bgColor: "bg-orange-50", icon: "🟠" },
    flow: { color: "text-green-600", bgColor: "bg-green-50", icon: "🟢" },
    bored: { color: "text-yellow-600", bgColor: "bg-yellow-50", icon: "🟡" },
    mastering: { color: "text-blue-600", bgColor: "bg-blue-50", icon: "🔵" },
  };

  const stateStyle = stateConfig[cognitiveState] || stateConfig.flow;

  // Impact badge colors
  const impactColors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <div className="mb-3">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${isExpanded
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 3v18M3 12l9 9 9-9" />
        </svg>
        <span>{stateStyle.icon}</span>
        <span>Why this response?</span>
        {cognitiveState && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${stateStyle.bgColor} ${stateStyle.color}`}>
            {cognitiveState}
          </span>
        )}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-card border border-border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-full ${stateStyle.bgColor} flex items-center justify-center`}>
              <span className="text-lg">{stateStyle.icon}</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Adaptive Response</h4>
              <p className="text-xs text-muted-foreground">Personalized for your learning style</p>
            </div>
          </div>

          {/* Factors Grid */}
          <div className="grid gap-2 mb-3">
            {factors.map((factor, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2.5 bg-muted/30 rounded-lg"
              >
                <div className="flex-shrink-0">
                  <FactorIcon type={factor.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground">{factor.label}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${impactColors[factor.impact] || impactColors.low}`}>
                      {factor.impact}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Strategy Summary */}
          {strategy && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {strategy.force_visual && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                  Visual Priority
                </span>
              )}
              <span className="px-2 py-1 bg-muted rounded text-[10px] font-medium text-muted-foreground">
                Length: {strategy.response_length}
              </span>
              <span className="px-2 py-1 bg-muted rounded text-[10px] font-medium text-muted-foreground">
                Style: {strategy.explanation_style}
              </span>
              {strategy.interaction_mode === "interactive" && (
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-[10px] font-medium">
                  Interactive
                </span>
              )}
            </div>
          )}

          {/* Debug Info (collapsed by default) */}
          {debugInfo && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Debug Info
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Icon for each factor type
 */
function FactorIcon({ type }) {
  const icons = {
    cognitive_state: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
    topic_strength: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    learning_style: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    knowledge_level: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    progression_trend: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
      </svg>
    ),
    policy_action: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    confidence: (
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  };

  return icons[type] || (
    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
