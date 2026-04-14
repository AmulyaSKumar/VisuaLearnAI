import { useState } from 'react';
import { renderMarkdown } from '../../utils/renderMarkdown';

/**
 * Safely extract string content from potentially complex data
 */
function extractText(item) {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    return item.text || item.content || item.description || item.title || JSON.stringify(item);
  }
  return String(item);
}

export default function ConceptsView({ concepts, keyTakeaways }) {
  const [expandedConcept, setExpandedConcept] = useState(null);

  // Normalize keyTakeaways to ensure it's an array of strings
  const normalizedTakeaways = Array.isArray(keyTakeaways)
    ? keyTakeaways.map(extractText).filter(Boolean)
    : [];

  if (!concepts?.length && !normalizedTakeaways?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p>No concepts available</p>
      </div>
    );
  }

  const getImportanceColor = (importance) => {
    switch (importance) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Concepts */}
      {concepts?.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Key Concepts
          </h4>

          <div className="space-y-2">
            {concepts.map((concept) => (
              <div
                key={concept.id}
                className="bg-muted/30 border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedConcept(expandedConcept === concept.id ? null : concept.id)}
                  className="w-full p-3 sm:p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors min-h-[44px]"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getImportanceColor(concept.importance)}`} />
                    <span className="font-medium text-foreground text-sm sm:text-base truncate">{concept.title}</span>
                    <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize flex-shrink-0">
                      {concept.importance}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      expandedConcept === concept.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedConcept === concept.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-border/50">
                    <div
                      className="text-sm text-foreground/80 leading-relaxed mt-3"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(concept.description || '') }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Takeaways */}
      {normalizedTakeaways?.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Key Takeaways
          </h4>
          <ul className="space-y-2">
            {normalizedTakeaways.map((takeaway, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-foreground/80">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(takeaway) }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Importance Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-muted-foreground pt-4 border-t border-border">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Foundational
        </span>
      </div>
    </div>
  );
}
