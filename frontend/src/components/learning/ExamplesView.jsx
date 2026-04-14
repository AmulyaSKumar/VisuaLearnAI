import { useState } from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function ExamplesView({ examples, tryThis }) {
  const [expandedExample, setExpandedExample] = useState(0);
  const [showHint, setShowHint] = useState({});

  if (!examples?.length && !tryThis?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p>No examples available</p>
      </div>
    );
  }

  const toggleHint = (idx) => {
    setShowHint(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6">
      {/* Real-World Examples */}
      {examples?.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Real-World Examples
          </h4>

          <div className="space-y-2">
            {examples.map((example, idx) => (
              <div
                key={idx}
                className="bg-muted/30 border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedExample(expandedExample === idx ? -1 : idx)}
                  className="w-full p-3 sm:p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors min-h-[44px]"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary text-xs sm:text-sm font-medium flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground text-sm sm:text-base truncate">{example.title}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      expandedExample === idx ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedExample === idx && (
                  <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-3">
                    <div className="mt-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scenario</span>
                      <div
                        className="text-sm text-foreground/80 mt-1 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(example.scenario || '') }}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How it applies</span>
                      <div
                        className="text-sm text-foreground/80 mt-1 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(example.explanation || '') }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Try This Exercises */}
      {tryThis?.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Try This!
          </h4>

          <div className="space-y-3">
            {tryThis.map((exercise, idx) => (
              <div
                key={idx}
                className="p-4 bg-gradient-to-br from-green-500/5 to-green-500/10 border border-green-500/20 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-foreground leading-relaxed">
                      {exercise.prompt}
                    </p>

                    {exercise.hint && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleHint(idx)}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {showHint[idx] ? 'Hide hint' : 'Show hint'}
                        </button>

                        {showHint[idx] && (
                          <p className="mt-2 text-xs text-muted-foreground bg-background/50 p-2 rounded-lg">
                            {exercise.hint}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3 pt-4 border-t border-border">
        <button className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="truncate">More Examples</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="truncate">Explain Differently</span>
        </button>
      </div>
    </div>
  );
}
