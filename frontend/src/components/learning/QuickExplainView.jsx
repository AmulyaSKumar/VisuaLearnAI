import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ListenButton from './ListenButton';

/**
 * QuickExplainView
 * Renders a concise explanation for "what is X" style queries
 * Includes progressive disclosure buttons to expand to deeper content
 */
export default function QuickExplainView({
  content,
  topic,
  onExpand,
  onOpenTab,
  isExpanding = false,
}) {
  const [showCode, setShowCode] = useState(false);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No content available</p>
      </div>
    );
  }

  const {
    title,
    explanation,
    analogy,
    example,
    key_takeaway,
    complexity_note,
    next_step,
  } = content;

  // Build readable text for TTS
  const readableText = [
    title,
    explanation,
    analogy?.explanation || analogy?.comparison,
    key_takeaway,
  ].filter(Boolean).join('. ');

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-md">
            Quick Explanation
          </span>
          <ListenButton text={readableText} variant="default" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {title || topic}
        </h1>
      </header>

      {/* Main Explanation */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
          {explanation}
        </p>
      </div>

      {/* Analogy Section */}
      {analogy && (
        <blockquote className="border-l-4 border-primary/40 pl-4 py-2 bg-muted/30 rounded-r-lg">
          <p className="text-sm font-medium text-foreground mb-1">
            {analogy.comparison || 'Think of it like...'}
          </p>
          {analogy.explanation && (
            <p className="text-sm text-muted-foreground">
              {analogy.explanation}
            </p>
          )}
        </blockquote>
      )}

      {/* Code Example (collapsible) */}
      {example && example.code && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowCode(!showCode)}
            className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="text-sm font-medium text-foreground">
              {showCode ? 'Hide' : 'Show'} Code Example
            </span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${showCode ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border"
            >
              <div className="p-4 bg-zinc-900 dark:bg-zinc-950">
                <pre className="text-sm font-mono text-zinc-100 overflow-x-auto whitespace-pre-wrap">
                  {example.code}
                </pre>
              </div>
              {example.explanation && (
                <p className="px-4 py-3 text-sm text-muted-foreground border-t border-border">
                  {example.explanation}
                </p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Key Takeaway */}
      {key_takeaway && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
            Key Takeaway
          </p>
          <p className="text-sm text-foreground font-medium">
            {key_takeaway}
          </p>
        </div>
      )}

      {/* Complexity Note */}
      {complexity_note && (
        <p className="text-xs text-muted-foreground">
          {complexity_note}
        </p>
      )}

      {/* Progressive Disclosure Actions */}
      <div className="pt-6 border-t border-border space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Want to learn more?
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Learn More - Triggers deep_learn mode */}
          <button
            onClick={() => onExpand?.('deep_learn')}
            disabled={isExpanding}
            className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExpanding ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Learn More
              </>
            )}
          </button>

          {/* See Examples */}
          <button
            onClick={() => onOpenTab?.('examples')}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            See Examples
          </button>

          {/* Practice */}
          <button
            onClick={() => onOpenTab?.('quiz')}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Practice
          </button>

          {/* Flashcards */}
          <button
            onClick={() => onOpenTab?.('flashcards')}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Flashcards
          </button>
        </div>

        {/* Next Step Suggestion */}
        {next_step && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Next:</span> {next_step}
          </p>
        )}
      </div>
    </motion.article>
  );
}
