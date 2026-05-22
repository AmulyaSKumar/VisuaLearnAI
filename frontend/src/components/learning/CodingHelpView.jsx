import { useState } from 'react';
import { motion } from 'framer-motion';
import ListenButton from './ListenButton';

const MotionDiv = motion.div;

/**
 * CodingHelpView
 * Renders debugging and code fixing assistance
 * Shows issue identification, fix, and corrected code
 */
export default function CodingHelpView({
  content,
  topic,
  onOpenTab,
}) {
  const [copiedCode, setCopiedCode] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No content available</p>
      </div>
    );
  }

  const {
    query_type,
    language,
    // Debug mode fields
    issue,
    fix,
    original_code,
    corrected_code,
    // Explain mode fields
    code_analysis,
    line_by_line,
    potential_issues,
    // How-to mode fields
    solution,
    code,
    explanation,
    alternatives,
    // Common fields
    best_practices,
    common_mistakes,
    learn_more,
  } = content;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(label);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Build readable text for TTS
  const readableText = [
    issue?.summary,
    fix?.summary,
    code_analysis?.purpose,
    solution?.approach,
    explanation,
  ].filter(Boolean).join('. ');

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 rounded-md">
              {query_type === 'debug' ? 'Debug Help' : query_type === 'explain' ? 'Code Explanation' : 'How-To'}
            </span>
            {language && (
              <span className="px-2 py-0.5 text-xs font-mono text-muted-foreground bg-muted rounded">
                {language}
              </span>
            )}
          </div>
          <ListenButton text={readableText} variant="default" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {topic || issue?.summary || solution?.approach || 'Code Help'}
        </h1>
      </header>

      {/* DEBUG MODE */}
      {query_type === 'debug' && issue && (
        <>
          {/* Issue Card */}
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-medium text-red-800 dark:text-red-300">{issue.summary}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
              <span className="px-1.5 py-0.5 bg-red-200 dark:bg-red-800 rounded">{issue.type}</span>
              {issue.location && <span>at {issue.location}</span>}
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">{issue.explanation}</p>
          </div>

          {/* Fix Card */}
          {fix && (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium text-green-800 dark:text-green-300">{fix.summary}</p>
              </div>
              {fix.steps && fix.steps.length > 0 && (
                <ul className="space-y-1">
                  {fix.steps.map((step, idx) => (
                    <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex gap-2">
                      <span className="font-medium">{idx + 1}.</span> {step}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Code Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Code */}
            {original_code && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-red-100 dark:bg-red-950/50 border-b border-border">
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Before (Problematic)</span>
                  <button
                    onClick={() => copyToClipboard(original_code, 'original')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedCode === 'original' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 bg-zinc-900 text-zinc-100 font-mono text-sm overflow-x-auto">
                  {original_code}
                </pre>
              </div>
            )}

            {/* Corrected Code */}
            {corrected_code && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-green-100 dark:bg-green-950/50 border-b border-border">
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">After (Fixed)</span>
                  <button
                    onClick={() => copyToClipboard(corrected_code, 'corrected')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedCode === 'corrected' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 bg-zinc-900 text-zinc-100 font-mono text-sm overflow-x-auto">
                  {corrected_code}
                </pre>
              </div>
            )}
          </div>
        </>
      )}

      {/* EXPLAIN MODE */}
      {query_type === 'explain' && code_analysis && (
        <>
          {/* Purpose */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-950/30 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-400 uppercase tracking-wide mb-1">
              What This Code Does
            </p>
            <p className="text-foreground">{code_analysis.purpose}</p>
            {code_analysis.key_concepts && code_analysis.key_concepts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {code_analysis.key_concepts.map((concept, idx) => (
                  <span key={idx} className="px-2 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded">
                    {concept}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Execution Flow */}
          {code_analysis.flow && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Execution Flow
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{code_analysis.flow}</p>
            </div>
          )}

          {/* Line by Line */}
          {line_by_line && line_by_line.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-sm font-medium text-foreground">Line-by-Line Breakdown</span>
              </div>
              <div className="divide-y divide-border">
                {line_by_line.map((item, idx) => (
                  <div key={idx} className="p-3 hover:bg-muted/30 transition-colors">
                    <code className="text-sm font-mono text-primary">{item.line}</code>
                    <p className="text-sm text-muted-foreground mt-1">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Potential Issues */}
          {potential_issues && potential_issues.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
                Things to Watch Out For
              </p>
              <ul className="space-y-1">
                {potential_issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                    <span aria-hidden="true">!</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* HOW-TO MODE */}
      {query_type === 'howto' && solution && (
        <>
          {/* Approach */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
              Approach
            </p>
            <p className="text-foreground">{solution.approach}</p>
            {solution.key_concepts && solution.key_concepts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {solution.key_concepts.map((concept, idx) => (
                  <span key={idx} className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                    {concept}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Solution Code */}
          {code && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase">Solution</span>
                <button
                  onClick={() => copyToClipboard(code, 'solution')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {copiedCode === 'solution' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 bg-zinc-900 text-zinc-100 font-mono text-sm overflow-x-auto">
                {code}
              </pre>
            </div>
          )}

          {/* Explanation */}
          {explanation && (
            <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
          )}

          {/* Alternatives */}
          {alternatives && alternatives.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">Alternative Approaches</span>
                <svg
                  className={`w-4 h-4 text-muted-foreground transition-transform ${showAlternatives ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAlternatives && (
                <div className="p-4 space-y-4 border-t border-border">
                  {alternatives.map((alt, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-medium text-foreground">{alt.approach}</p>
                      {alt.code && (
                        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-xs rounded overflow-x-auto">
                          {alt.code}
                        </pre>
                      )}
                      {alt.when_to_use && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">When to use:</span> {alt.when_to_use}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Best Practices */}
      {best_practices && best_practices.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Best Practices
          </p>
          <ul className="space-y-1">
            {best_practices.map((practice, idx) => (
              <li key={idx} className="text-sm text-foreground flex gap-2">
                <span className="text-green-500">OK</span> {practice}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common Mistakes */}
      {common_mistakes && common_mistakes.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
          <p className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">
            Common Mistakes to Avoid
          </p>
          {common_mistakes.map((item, idx) => (
            <div key={idx} className="text-sm space-y-0.5">
              <p className="text-red-700 dark:text-red-400">
                <span className="font-medium">Mistake:</span> {item.mistake}
              </p>
              <p className="text-green-700 dark:text-green-400 pl-4">
                <span className="font-medium">Correct:</span> {item.correct}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="pt-6 border-t border-border flex flex-wrap gap-3">
        <button
          onClick={() => onOpenTab?.('quiz')}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Test Your Understanding
        </button>
      </div>

      {/* Learn More */}
      {learn_more && learn_more.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Related topics:</span> {learn_more.join(', ')}
        </p>
      )}
    </MotionDiv>
  );
}
