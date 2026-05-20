import { useState } from 'react';

/**
 * Learning Plan Card Component
 * Displays a structured learning plan with steps
 */
export default function LearningPlanCard({ plan, onStepClick, isLoading = false }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  if (isLoading) {
    return (
      <div className="bg-muted/30 rounded-xl border border-border/50 p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const toggleStep = (stepNumber) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-primary/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{plan.title || 'Learning Plan'}</h3>
            {plan.overview && (
              <p className="text-sm text-muted-foreground mt-1">{plan.overview}</p>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-3 mt-4">
          {plan.estimatedDuration && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs font-medium text-muted-foreground">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {plan.estimatedDuration}
            </span>
          )}
          {plan.steps && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs font-medium text-muted-foreground">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {plan.steps.length} steps
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 sm:p-6 space-y-3">
        {plan.steps?.map((step, index) => (
          <div
            key={step.number || index}
            className="bg-background/50 rounded-lg border border-border/50 overflow-hidden transition-all hover:border-primary/30"
          >
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.number || index)}
              className="w-full p-4 flex items-start gap-3 text-left"
            >
              {/* Step Number */}
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                {step.number || index + 1}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground">{step.title}</h4>
                {step.duration && (
                  <span className="text-xs text-muted-foreground">{step.duration}</span>
                )}
              </div>

              {/* Expand Icon */}
              <svg
                className={`w-5 h-5 text-muted-foreground transition-transform ${
                  expandedSteps[step.number || index] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded Content */}
            {expandedSteps[step.number || index] && (
              <div className="px-4 pb-4 pt-0 border-t border-border/30">
                {step.description && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {step.description}
                  </p>
                )}

                {/* Resources */}
                {step.resources && step.resources.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Resources
                    </h5>
                    <div className="space-y-2">
                      {step.resources.map((resource, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-start gap-2 p-2 rounded-md bg-muted/30"
                        >
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            resource.type === 'visualization'
                              ? 'bg-neutral-500/20 text-neutral-600'
                              : resource.type === 'explanation'
                              ? 'bg-green-500/20 text-green-600'
                              : 'bg-gray-500/20 text-gray-600'
                          }`}>
                            {resource.type}
                          </span>
                          <span className="text-sm text-foreground/80">
                            {resource.description || resource.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {onStepClick && (
                  <button
                    onClick={() => onStepClick(step)}
                    className="mt-4 w-full py-2 px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                  >
                    Start this step
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prerequisites */}
      {plan.prerequisites && plan.prerequisites.length > 0 && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Prerequisites
          </h5>
          <ul className="space-y-1">
            {plan.prerequisites.map((prereq, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-foreground/80">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {prereq}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Learning Outcomes */}
      {plan.learningOutcomes && plan.learningOutcomes.length > 0 && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-primary/10 pt-4">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            What you'll learn
          </h5>
          <ul className="space-y-1">
            {plan.learningOutcomes.map((outcome, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-foreground/80">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
