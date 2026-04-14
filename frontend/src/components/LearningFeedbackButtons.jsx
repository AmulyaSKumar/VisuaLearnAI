import { useState } from "react";

/**
 * LearningFeedbackButtons - Enhanced feedback for adaptive learning
 * Provides specific feedback options that influence personalization
 */
export default function LearningFeedbackButtons({
  messageId,
  userId,
  onFeedback,
  showExpanded = false,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [isExpanded, setIsExpanded] = useState(showExpanded);

  const feedbackOptions = [
    {
      id: "understand",
      label: "I understand",
      icon: "✓",
      color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
      activeColor: "bg-green-500 text-white border-green-500",
      signal: "positive",
    },
    {
      id: "confused",
      label: "Still confused",
      icon: "?",
      color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      activeColor: "bg-orange-500 text-white border-orange-500",
      signal: "negative",
    },
    {
      id: "different",
      label: "Show differently",
      icon: "↻",
      color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      activeColor: "bg-blue-500 text-white border-blue-500",
      signal: "change_modality",
    },
    {
      id: "challenge",
      label: "Give challenge",
      icon: "⚡",
      color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
      activeColor: "bg-purple-500 text-white border-purple-500",
      signal: "increase_difficulty",
    },
  ];

  const handleFeedback = async (option) => {
    if (isSubmitting || submitted) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("http://localhost:3001/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messageId,
          feedbackType: option.id,
          signal: option.signal,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setSubmitted(option.id);
        if (onFeedback) {
          onFeedback(option);
        }
      }
    } catch (err) {
      console.error("Feedback submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compact view - just show toggle
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Give feedback
      </button>
    );
  }

  return (
    <div className="mt-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-xs font-medium text-muted-foreground">How was this explanation?</p>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-0.5 hover:bg-muted rounded transition-colors ml-auto"
        >
          <svg className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {feedbackOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => handleFeedback(option)}
            disabled={isSubmitting || submitted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${submitted === option.id
                ? option.activeColor
                : submitted
                  ? "opacity-50 cursor-not-allowed " + option.color
                  : option.color
              }
              ${isSubmitting ? "cursor-wait" : ""}
            `}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
            {submitted === option.id && (
              <svg className="w-3.5 h-3.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {submitted && (
        <p className="mt-2 text-xs text-muted-foreground animate-in fade-in">
          {submitted === "understand" && "Great! We'll keep this approach."}
          {submitted === "confused" && "We'll simplify and provide more examples."}
          {submitted === "different" && "Trying a different explanation style..."}
          {submitted === "challenge" && "Increasing difficulty for you!"}
        </p>
      )}
    </div>
  );
}
