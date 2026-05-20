import { useState, useEffect } from "react";

/**
 * LearningStatePanel - Real-time display of user's learning state
 * Shows cognitive state, learning style, confidence, and topic status
 */
export default function LearningStatePanel({
  cognitiveState = "flow",
  learningStyle = {},
  confidenceScore = 0.5,
  currentTopic = null,
  strategy = {},
  weakTopics = [],
  strongTopics = [],
  isCompact = false,
}) {
  const [isExpanded, setIsExpanded] = useState(!isCompact);

  // Cognitive state config
  const stateConfig = {
    struggling: { label: "Struggling", color: "bg-red-500", textColor: "text-red-600", description: "Need more support" },
    confused: { label: "Confused", color: "bg-orange-500", textColor: "text-orange-600", description: "Clarifying concepts" },
    flow: { label: "In Flow", color: "bg-green-500", textColor: "text-green-600", description: "Learning optimally" },
    bored: { label: "Bored", color: "bg-yellow-500", textColor: "text-yellow-600", description: "Ready for challenge" },
    mastering: { label: "Mastering", color: "bg-neutral-500", textColor: "text-neutral-600", description: "Strong understanding" },
  };

  const currentStateConfig = stateConfig[cognitiveState] || stateConfig.flow;

  // Calculate dominant learning style
  const styles = learningStyle || {};
  const sortedStyles = Object.entries(styles).sort(([, a], [, b]) => b - a);
  const dominantStyle = sortedStyles[0] || ["visual", 0.25];
  const dominantPercent = Math.round((dominantStyle[1] || 0.25) * 100);

  // Style icons
  const styleIcons = {
    visual: "",
    auditory: "",
    reading: "",
    kinesthetic: "",
  };

  // Check if current topic is weak/strong
  const topicLower = (currentTopic || "").toLowerCase();
  const isWeakTopic = weakTopics.some(t => topicLower.includes(t) || t.includes(topicLower));
  const isStrongTopic = strongTopics.some(t => topicLower.includes(t) || t.includes(topicLower));

  // Compact view
  if (isCompact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full text-xs font-medium hover:bg-muted transition-colors"
      >
        <span className={currentStateConfig.textColor}>{currentStateConfig.label}</span>
        <span className="text-muted-foreground">|</span>
        <span>{styleIcons[dominantStyle[0]] || ""}</span>
        <span>{dominantPercent}%</span>
        <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
            <path d="M12 6v6l4 2" />
          </svg>
          Learning State
        </h3>
        {isCompact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* State Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cognitive State */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Cognitive State</span>
          </div>
          <p className={`text-sm font-semibold ${currentStateConfig.textColor}`}>
            {currentStateConfig.label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {currentStateConfig.description}
          </p>
        </div>

        {/* Learning Style */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{styleIcons[dominantStyle[0]] || ""}</span>
            <span className="text-xs font-medium text-muted-foreground">Learning Style</span>
          </div>
          <p className="text-sm font-semibold text-foreground capitalize">
            {dominantStyle[0]} <span className="text-primary">{dominantPercent}%</span>
          </p>
          {/* Mini style bars */}
          <div className="flex gap-1 mt-1.5">
            {sortedStyles.slice(0, 4).map(([style, score]) => (
              <div
                key={style}
                className="flex-1 h-1 rounded-full bg-muted overflow-hidden"
                title={`${style}: ${Math.round(score * 100)}%`}
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${score * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Score */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg"></span>
            <span className="text-xs font-medium text-muted-foreground">Profile Confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  confidenceScore > 0.7 ? "bg-green-500" :
                  confidenceScore > 0.4 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${confidenceScore * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground">
              {Math.round(confidenceScore * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {confidenceScore > 0.7 ? "Strong profile data" :
             confidenceScore > 0.4 ? "Building profile" : "Learning your style"}
          </p>
        </div>

        {/* Current Topic */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg"></span>
            <span className="text-xs font-medium text-muted-foreground">Current Topic</span>
          </div>
          {currentTopic ? (
            <>
              <p className="text-sm font-semibold text-foreground capitalize truncate">
                {currentTopic}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {isWeakTopic && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
                    Needs Work
                  </span>
                )}
                {isStrongTopic && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                    Strong
                  </span>
                )}
                {!isWeakTopic && !isStrongTopic && (
                  <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-medium">
                    Neutral
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No topic detected</p>
          )}
        </div>
      </div>

      {/* Strategy Summary (if available) */}
      {strategy && Object.keys(strategy).length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-medium text-muted-foreground mb-2">ACTIVE STRATEGY</p>
          <div className="flex flex-wrap gap-1.5">
            {strategy.force_visual && (
              <span className="px-2 py-0.5 bg-neutral-50 text-neutral-700 rounded-full text-[10px] font-medium">
                Visual Priority
              </span>
            )}
            <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground">
              {strategy.explanation_style || "detailed"}
            </span>
            <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground">
              {strategy.response_length || "medium"}
            </span>
            {strategy.interaction_mode === "interactive" && (
              <span className="px-2 py-0.5 bg-neutral-50 text-neutral-700 rounded-full text-[10px] font-medium">
                Interactive
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
