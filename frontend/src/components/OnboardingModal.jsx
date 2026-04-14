import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * OnboardingModal - First-time user learning preference selection
 * Collects initial learning style preference to bootstrap personalization
 */
export default function OnboardingModal({ isOpen, onComplete, onSkip, userId }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [pacePreference, setPacePreference] = useState(null);
  const [learningLevel, setLearningLevel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle skip - close modal without saving preferences
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else if (onComplete) {
      onComplete(null);
    }
  };

  const learningStyles = [
    {
      id: "visual",
      label: "Visual Learner",
      description: "I learn best with diagrams, charts, and visual aids",
    },
    {
      id: "kinesthetic",
      label: "Hands-on Learner",
      description: "I prefer interactive exercises and learning by doing",
    },
    {
      id: "reading",
      label: "Reading/Writing",
      description: "I learn well through text explanations and notes",
    },
    {
      id: "auditory",
      label: "Auditory Learner",
      description: "I prefer listening to explanations and discussions",
    },
  ];

  const paceOptions = [
    {
      id: "slow",
      label: "Slow Pace",
      description: "Detailed explanations with examples and step-by-step guidance.",
    },
    {
      id: "normal",
      label: "Balanced Pace",
      description: "Standard explanation speed with a mix of concepts and examples.",
    },
    {
      id: "fast",
      label: "Fast Pace",
      description: "Concise explanations focusing on key concepts, skipping basic details where possible.",
    },
  ];

  const levelOptions = [
    {
      id: "beginner",
      label: "Beginner",
      description: "Suitable for users who are new to the topic. Explanations will be simple, with basic concepts and step-by-step guidance.",
    },
    {
      id: "intermediate",
      label: "Intermediate",
      description: "For users with some prior knowledge. Explanations will include concepts and practical understanding.",
    },
    {
      id: "advanced",
      label: "Advanced",
      description: "For users with strong background. Focus will be on deeper insights, optimization, and technical details.",
    },
  ];

  const handleComplete = async () => {
    console.log("Submitting onboarding...", { learningLevel, pacePreference, selectedStyle });

    // Validate all selections are made
    if (!learningLevel || !pacePreference || !selectedStyle) {
      console.warn("Missing selections:", { learningLevel, pacePreference, selectedStyle });
      return;
    }

    setIsSubmitting(true);

    // Helper function to complete and navigate
    const completeOnboarding = () => {
      console.log("Completing onboarding, navigating to chat...");
      onComplete({ selectedStyle, pacePreference, learningLevel });
      // Navigation is handled by parent closing the modal - user is already on chat page
    };

    if (!userId) {
      completeOnboarding();
      setIsSubmitting(false);
      return;
    }

    try {
      // Build initial style scores
      const styleScores = {
        visual: selectedStyle === "visual" ? 0.6 : 0.13,
        auditory: selectedStyle === "auditory" ? 0.6 : 0.13,
        reading: selectedStyle === "reading" ? 0.6 : 0.13,
        kinesthetic: selectedStyle === "kinesthetic" ? 0.6 : 0.14,
      };

      const response = await fetch(`http://localhost:3001/api/user/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learning_style: selectedStyle,
          detected_styles: styleScores,
          pace_preference: pacePreference,
          comprehension_level: learningLevel,
          onboarding_completed: true,
        }),
      });

      if (!response.ok) {
        console.warn("API returned non-ok status:", response.status);
      }

      // Complete regardless of API response - don't block user
      completeOnboarding();
    } catch (err) {
      console.error("Failed to save preferences:", err);
      // Fallback: Still complete even if save fails - don't block user
      completeOnboarding();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedStyle !== null;
    if (step === 2) return pacePreference !== null;
    if (step === 3) return learningLevel !== null;
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-blue-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Welcome to VisuaLearn</h2>
                <p className="text-sm text-muted-foreground">Let's personalize your learning experience</p>
              </div>
            </div>
            {/* Skip button */}
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50"
            >
              Skip for now
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Step {step} of 3</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Learning Style */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <h3 className="text-base font-medium text-foreground text-center">
                How do you prefer to learn?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {learningStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedStyle === style.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{style.label}</p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{style.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pace */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <h3 className="text-base font-medium text-foreground text-center">
                What's your preferred learning pace?
              </h3>
              <div className="space-y-3">
                {paceOptions.map((pace) => (
                  <button
                    key={pace.id}
                    onClick={() => setPacePreference(pace.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      pacePreference === pace.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{pace.label}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{pace.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Level */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <h3 className="text-base font-medium text-foreground text-center">
                What's your current knowledge level?
              </h3>
              <div className="space-y-3">
                {levelOptions.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setLearningLevel(level.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      learningLevel === level.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{level.label}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleComplete();
              }
            }}
            disabled={!canProceed() || isSubmitting}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canProceed() && !isSubmitting
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Saving...
              </span>
            ) : step < 3 ? (
              "Continue"
            ) : (
              "Start Learning"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
