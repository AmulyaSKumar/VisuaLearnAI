import { useState } from "react";

/**
 * AdaptiveFeedbackBanner - Subtle banner showing why a response was adapted
 * Displays cognitive state, adaptation reason, and strategy changes
 */
export default function AdaptiveFeedbackBanner({
  personalizationMeta,
  isVisible = true,
  compact = true,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!personalizationMeta || !isVisible) return null;

  const { explanation, cognitiveState, topic, strategy } = personalizationMeta;

  // State configuration
  const stateConfig = {
    struggling: {
      icon: "🔴",
      label: "Supporting",
      color: "border-red-200 bg-red-50 text-red-700",
      description: "Extra support mode activated"
    },
    confused: {
      icon: "🟠",
      label: "Clarifying",
      color: "border-orange-200 bg-orange-50 text-orange-700",
      description: "Simplifying explanations"
    },
    flow: {
      icon: "🟢",
      label: "Optimal",
      color: "border-green-200 bg-green-50 text-green-700",
      description: "Learning at your best pace"
    },
    bored: {
      icon: "🟡",
      label: "Challenging",
      color: "border-yellow-200 bg-yellow-50 text-yellow-700",
      description: "Increasing difficulty"
    },
    mastering: {
      icon: "🔵",
      label: "Advancing",
      color: "border-blue-200 bg-blue-50 text-blue-700",
      description: "Moving to deeper concepts"
    },
  };

  const currentState = stateConfig[cognitiveState] || stateConfig.flow;

  // Extract key adaptation reasons
  const adaptationReasons = [];

  if (explanation?.factors) {
    explanation.factors.forEach(factor => {
      if (factor.impact === 'high') {
        adaptationReasons.push({
          type: factor.type,
          label: factor.label,
          value: factor.value,
          description: factor.description,
        });
      }
    });
  }

  // Strategy changes
  const strategyChanges = [];
  if (strategy?.force_visual) {
    strategyChanges.push({ icon: "👁️", label: "Visual mode" });
  }
  if (strategy?.interaction_mode === "interactive") {
    strategyChanges.push({ icon: "🎮", label: "Interactive" });
  }
  if (strategy?.explanation_style === "simple") {
    strategyChanges.push({ icon: "📝", label: "Simplified" });
  }
  if (strategy?.explanation_style === "technical") {
    strategyChanges.push({ icon: "🔬", label: "Technical" });
  }

  // Compact view (default)
  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium transition-all hover:shadow-sm ${currentState.color}`}
      >
        <span>{currentState.icon}</span>
        <span>{currentState.label}</span>
        {topic && (
          <>
            <span className="w-px h-3 bg-current opacity-30" />
            <span className="opacity-70 truncate max-w-20">{topic}</span>
          </>
        )}
        <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 mb-3">
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${currentState.color}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentState.icon}</span>
          <div>
            <p className="text-xs font-semibold">{currentState.label} Mode</p>
            <p className="text-[10px] opacity-80">{currentState.description}</p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-black/10 rounded transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Adaptation Reasons */}
        {adaptationReasons.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Adaptation Triggers
            </p>
            <div className="space-y-1.5">
              {adaptationReasons.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{reason.label}:</span>{" "}
                    <span className="text-muted-foreground">{reason.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategy Changes */}
        {strategyChanges.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Active Strategies
            </p>
            <div className="flex flex-wrap gap-1.5">
              {strategyChanges.map((change, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-foreground"
                >
                  <span>{change.icon}</span>
                  <span>{change.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Topic */}
        {topic && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Topic:</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
              {topic}
            </span>
          </div>
        )}

        {/* Summary from explanation */}
        {explanation?.reasons?.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Why This Response
            </p>
            <ul className="space-y-1">
              {explanation.reasons.slice(0, 3).map((reason, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal inline version for compact spaces
 */
export function AdaptiveFeedbackInline({ cognitiveState, topic }) {
  const stateConfig = {
    struggling: { icon: "🔴", color: "text-red-600" },
    confused: { icon: "🟠", color: "text-orange-600" },
    flow: { icon: "🟢", color: "text-green-600" },
    bored: { icon: "🟡", color: "text-yellow-600" },
    mastering: { icon: "🔵", color: "text-blue-600" },
  };

  const state = stateConfig[cognitiveState] || stateConfig.flow;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${state.color}`}>
      <span>{state.icon}</span>
      {topic && <span className="opacity-70">{topic}</span>}
    </span>
  );
}
