import { useState } from 'react';

export default function LearningPathView({ learningPath, compact = false }) {
  const [showNextTopics, setShowNextTopics] = useState(false);

  if (!learningPath) return null;

  const { stages, current, nextTopics } = learningPath;

  if (compact) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground">Progress:</span>
        <div className="flex items-center gap-1">
          {stages?.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full ${
                  stage.status === 'completed'
                    ? 'bg-green-500'
                    : stage.status === 'current'
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted'
                }`}
                title={stage.label}
              />
              {idx < stages.length - 1 && (
                <div className={`w-4 h-0.5 ${
                  stage.status === 'completed' ? 'bg-green-500' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
        <span className="text-xs font-medium text-foreground ml-1">
          {current || stages?.find(s => s.status === 'current')?.label}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Learning Path */}
      <div className="bg-muted/30 rounded-xl p-4">
        <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Learning Path
        </h4>

        <div className="flex items-center justify-between gap-2">
          {stages?.map((stage, idx) => (
            <div key={stage.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    stage.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : stage.status === 'current'
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.status === 'completed' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  stage.status === 'current' ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {stage.label}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className={`h-0.5 w-full ${
                  stage.status === 'completed' ? 'bg-green-500' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Topics */}
      {nextTopics?.length > 0 && (
        <div>
          <button
            onClick={() => setShowNextTopics(!showNextTopics)}
            className="flex items-center justify-between w-full p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <span className="font-medium text-foreground flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Recommended Next Topics
            </span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${showNextTopics ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showNextTopics && (
            <div className="mt-2 p-4 bg-muted/30 rounded-xl space-y-2">
              {nextTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-background rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-foreground">{topic}</span>
                  <svg className="w-4 h-4 text-muted-foreground ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
