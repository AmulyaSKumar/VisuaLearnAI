import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// CONTENT BLOCK TYPE ICONS & LABELS
// ============================================

const BLOCK_ICONS = {
  concept: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  mistake: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  comparison: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  challenge: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  insight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

const BLOCK_TYPES = {
  concept: { label: 'Concept', color: 'border-blue-500/30 bg-blue-500/5' },
  code: { label: 'Code', color: 'border-emerald-500/30 bg-emerald-500/5' },
  mistake: { label: 'Common Mistake', color: 'border-amber-500/30 bg-amber-500/5' },
  comparison: { label: 'Comparison', color: 'border-purple-500/30 bg-purple-500/5' },
  challenge: { label: 'Challenge', color: 'border-rose-500/30 bg-rose-500/5' },
  insight: { label: 'Deep Insight', color: 'border-indigo-500/30 bg-indigo-500/5' },
};

const DIFFICULTY_CONFIG = {
  high: { label: 'Advanced', color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
  medium: { label: 'Intermediate', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  foundational: { label: 'Foundational', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
};

// ============================================
// CODE BLOCK WITH EXECUTION
// ============================================

function CodeBlock({ code, language, explanation, title }) {
  const [showPreview, setShowPreview] = useState(false);
  const [editedCode, setEditedCode] = useState(code || '');
  const iframeRef = useRef(null);

  const runCode = useCallback(() => {
    if (iframeRef.current && (language === 'html' || language === 'javascript')) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        const fullHtml = language === 'html'
          ? editedCode
          : `<html><body><script>${editedCode}</script></body></html>`;
        doc.open();
        doc.write(fullHtml);
        doc.close();
      }
    }
    setShowPreview(true);
  }, [editedCode, language]);

  const canExecute = ['html', 'javascript', 'css'].includes(language?.toLowerCase());

  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      )}

      {/* Code Editor */}
      <div className="relative">
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 dark:bg-zinc-950 rounded-t-lg border border-b-0 border-zinc-700">
          <span className="text-xs text-zinc-400 font-mono uppercase">{language || 'code'}</span>
          {canExecute && (
            <button
              onClick={runCode}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Run
            </button>
          )}
        </div>
        <textarea
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          className="w-full p-4 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 font-mono text-sm rounded-b-lg border border-t-0 border-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y min-h-[120px]"
          spellCheck={false}
        />
      </div>

      {/* Preview */}
      {showPreview && canExecute && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <iframe
            ref={iframeRef}
            title="Code Preview"
            className="w-full h-40 bg-white"
            sandbox="allow-scripts"
          />
        </div>
      )}

      {explanation && (
        <p className="text-sm text-muted-foreground">{explanation}</p>
      )}
    </div>
  );
}

// ============================================
// MISTAKE BLOCK
// ============================================

function MistakeBlock({ title, wrong, right, why }) {
  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Wrong */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide">Wrong</span>
          </div>
          <pre className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-sm font-mono text-rose-700 dark:text-rose-300 overflow-x-auto">
            {wrong}
          </pre>
        </div>

        {/* Right */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide">Correct</span>
          </div>
          <pre className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-sm font-mono text-emerald-700 dark:text-emerald-300 overflow-x-auto">
            {right}
          </pre>
        </div>
      </div>

      {why && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Why it matters:</span> {why}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPARISON BLOCK
// ============================================

function ComparisonBlock({ title, items = [] }) {
  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Feature</th>
              {items.map((item, i) => (
                <th key={i} className="text-left py-2 px-3 font-semibold text-foreground">
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3 text-muted-foreground">Description</td>
              {items.map((item, i) => (
                <td key={i} className="py-2 px-3 text-foreground">{item.description}</td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-3 text-muted-foreground">When to use</td>
              {items.map((item, i) => (
                <td key={i} className="py-2 px-3 text-foreground">{item.when_to_use}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// CHALLENGE BLOCK
// ============================================

function ChallengeBlock({ title, prompt, starter_code, solution, hints = [] }) {
  const [userCode, setUserCode] = useState(starter_code || '');
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(-1);

  return (
    <div className="space-y-4">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}

      <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-lg">
        <p className="text-sm text-foreground font-medium mb-3">{prompt}</p>

        <textarea
          value={userCode}
          onChange={(e) => setUserCode(e.target.value)}
          placeholder="Write your code here..."
          className="w-full p-3 bg-background border border-border rounded-lg font-mono text-sm resize-y min-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary/50"
        />

        <div className="flex items-center gap-2 mt-3">
          {hints.length > 0 && (
            <button
              onClick={() => setShowHint(prev => (prev + 1) % hints.length)}
              className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              Show Hint ({showHint + 1}/{hints.length})
            </button>
          )}
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            {showSolution ? 'Hide' : 'Show'} Solution
          </button>
        </div>

        {showHint >= 0 && hints[showHint] && (
          <div className="mt-3 p-2 bg-amber-500/10 rounded text-sm text-amber-700 dark:text-amber-300">
            <span className="font-medium">Hint:</span> {hints[showHint]}
          </div>
        )}

        {showSolution && solution && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Solution:</p>
            <pre className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-sm font-mono text-emerald-700 dark:text-emerald-300 overflow-x-auto">
              {solution}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CONTENT BLOCK RENDERER
// ============================================

function ContentBlock({ block }) {
  const config = BLOCK_TYPES[block.type] || BLOCK_TYPES.concept;
  const icon = BLOCK_ICONS[block.type] || BLOCK_ICONS.concept;

  return (
    <div className={`border rounded-lg p-4 ${config.color}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {config.label}
        </span>
      </div>

      {block.type === 'code' && (
        <CodeBlock
          code={block.code}
          language={block.language}
          explanation={block.explanation}
          title={block.title}
        />
      )}

      {block.type === 'mistake' && (
        <MistakeBlock
          title={block.title}
          wrong={block.wrong}
          right={block.right}
          why={block.why}
        />
      )}

      {block.type === 'comparison' && (
        <ComparisonBlock
          title={block.title}
          items={block.items}
        />
      )}

      {block.type === 'challenge' && (
        <ChallengeBlock
          title={block.title}
          prompt={block.prompt}
          starter_code={block.starter_code}
          solution={block.solution}
          hints={block.hints}
        />
      )}

      {(block.type === 'concept' || block.type === 'insight') && (
        <div className="space-y-2">
          {block.title && <h4 className="text-sm font-medium text-foreground">{block.title}</h4>}
          <p className="text-sm text-foreground/90 leading-relaxed">{block.content}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SIDEBAR CONCEPT ITEM
// ============================================

function SidebarItem({ idea, isActive, isCompleted, onClick }) {
  const config = DIFFICULTY_CONFIG[idea.difficulty] || DIFFICULTY_CONFIG.foundational;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isActive
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'hover:bg-muted/50 border-l-2 border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        {isCompleted ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>
            {idea.title}
          </p>
          {idea.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{idea.subtitle}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
              {config.label}
            </span>
            {idea.time_estimate && (
              <span className="text-[10px] text-muted-foreground">{idea.time_estimate} min</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================
// SKILL PROGRESS BAR
// ============================================

function SkillProgress({ skillAreas = [], completedIds }) {
  if (!skillAreas || skillAreas.length === 0) return null;

  return (
    <div className="p-4 border border-border rounded-lg bg-card">
      <h4 className="text-sm font-semibold text-foreground mb-3">Skill Progress</h4>
      <div className="space-y-3">
        {skillAreas.slice(0, 4).map((area, idx) => {
          const completed = area.concepts?.filter(c => completedIds.has(c)).length || 0;
          const total = area.concepts?.length || 1;
          const percent = Math.round((completed / total) * 100);

          return (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{area.name}</span>
                <span className="text-xs font-medium text-foreground">{percent}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MAIN CONTENT AREA
// ============================================

function MainContent({ idea, isCompleted, onMarkComplete }) {
  const config = DIFFICULTY_CONFIG[idea?.difficulty] || DIFFICULTY_CONFIG.foundational;
  const blocks = idea?.blocks || [];

  // Generate fallback blocks if none exist
  const displayBlocks = blocks.length > 0 ? blocks : [
    { type: 'concept', title: 'Overview', content: idea?.explanation || 'No content available.' }
  ];

  if (!idea) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Select a concept from the sidebar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{idea.title}</h2>
            {idea.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{idea.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {idea.time_estimate && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                {idea.time_estimate} min
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Blocks */}
      <div className="space-y-4">
        {displayBlocks.map((block, idx) => (
          <ContentBlock key={idx} block={block} />
        ))}
      </div>

      {/* Legacy analogy support */}
      {idea.analogy && !blocks.some(b => b.type === 'insight') && (
        <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Think of it like...
            </span>
          </div>
          <p className="text-sm text-foreground/90">{idea.analogy}</p>
        </div>
      )}

      {/* Mark Complete */}
      {!isCompleted && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={onMarkComplete}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark as Complete
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Completed</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPLETION STATE
// ============================================

function CompletionState({ topic, nextTopics = [], onGoToQuiz, onGoToFlashcards }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Section Complete</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You've completed all concepts in {topic || 'this section'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={onGoToFlashcards}
          className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-left"
        >
          <p className="font-medium text-foreground">Practice with Flashcards</p>
          <p className="text-xs text-muted-foreground mt-1">Reinforce your understanding</p>
        </button>
        <button
          onClick={onGoToQuiz}
          className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors text-left"
        >
          <p className="font-medium text-foreground">Take the Quiz</p>
          <p className="text-xs text-muted-foreground mt-1">Test your knowledge</p>
        </button>
      </div>

      {nextTopics && nextTopics.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Suggested Next Topics</h4>
          <div className="flex flex-wrap gap-2">
            {nextTopics.map((t, i) => (
              <span key={i} className="px-3 py-1 bg-muted rounded-full text-sm text-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function LearnTabView({
  summary,
  keyIdeas = [],
  readCards,
  onReadCard,
  onGoToQuiz,
  topic,
  onGoToFlashcards,
  onGoToMindMap,
  learningContent,
}) {
  const [activeConceptId, setActiveConceptId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainContentRef = useRef(null);

  // Safely access additional properties
  const skillAreas = learningContent?.skill_areas || [];
  const nextTopics = learningContent?.next_topics || [];
  const estimatedTime = learningContent?.estimated_time || keyIdeas.length * 3;
  const prerequisites = learningContent?.prerequisites || [];

  // Set first uncompleted concept as active on mount
  useEffect(() => {
    if (keyIdeas.length > 0 && !activeConceptId) {
      const firstUncompleted = keyIdeas.find(idea => !readCards.has(idea.id));
      setActiveConceptId(firstUncompleted?.id || keyIdeas[0].id);
    }
  }, [keyIdeas, readCards, activeConceptId]);

  const activeConcept = useMemo(() => {
    return keyIdeas.find(idea => idea.id === activeConceptId);
  }, [keyIdeas, activeConceptId]);

  const handleConceptClick = (id) => {
    setActiveConceptId(id);
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkComplete = useCallback(() => {
    if (activeConceptId) {
      onReadCard?.(activeConceptId);

      // Auto-advance to next uncompleted concept
      const currentIndex = keyIdeas.findIndex(i => i.id === activeConceptId);
      const nextUncompleted = keyIdeas.slice(currentIndex + 1).find(i => !readCards.has(i.id));
      if (nextUncompleted) {
        setTimeout(() => {
          setActiveConceptId(nextUncompleted.id);
          mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
      }
    }
  }, [activeConceptId, keyIdeas, readCards, onReadCard]);

  const progress = keyIdeas.length > 0
    ? Math.round((readCards.size / keyIdeas.length) * 100)
    : 0;

  const allCompleted = keyIdeas.length > 0 && readCards.size >= keyIdeas.length;

  if (!keyIdeas || keyIdeas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No learning content available</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className={`border-r border-border bg-muted/30 flex flex-col transition-all ${
        sidebarCollapsed ? 'w-12' : 'w-72'
      }`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Concepts</h3>
              <p className="text-xs text-muted-foreground">{readCards.size}/{keyIdeas.length} complete</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
          >
            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        {!sidebarCollapsed && (
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        )}

        {/* Concept List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {keyIdeas.map(idea => (
              <SidebarItem
                key={idea.id}
                idea={idea}
                isActive={activeConceptId === idea.id}
                isCompleted={readCards.has(idea.id)}
                onClick={() => handleConceptClick(idea.id)}
              />
            ))}
          </div>
        )}

        {/* Collapsed Icons */}
        {sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto py-2">
            {keyIdeas.map((idea, idx) => (
              <button
                key={idea.id}
                onClick={() => handleConceptClick(idea.id)}
                className={`w-full p-2 flex items-center justify-center ${
                  activeConceptId === idea.id ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
                title={idea.title}
              >
                {readCards.has(idea.id) ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                    activeConceptId === idea.id ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Skill Progress */}
        {!sidebarCollapsed && skillAreas.length > 0 && (
          <div className="p-3 border-t border-border">
            <SkillProgress skillAreas={skillAreas} completedIds={readCards} />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div ref={mainContentRef} className="flex-1 overflow-y-auto p-6">
        {/* Overview Banner */}
        {!allCompleted && activeConceptId === keyIdeas[0]?.id && summary && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">About this topic</h3>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {estimatedTime && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ~{estimatedTime} min
                  </span>
                )}
                <span>{keyIdeas.length} concepts</span>
              </div>
            </div>
            {prerequisites.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Prerequisites: </span>
                {prerequisites.map((p, i) => (
                  <span key={i} className="text-xs text-foreground">{p}{i < prerequisites.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content or Completion */}
        {allCompleted ? (
          <CompletionState
            topic={topic}
            nextTopics={nextTopics}
            onGoToQuiz={onGoToQuiz}
            onGoToFlashcards={onGoToFlashcards}
          />
        ) : (
          <MainContent
            idea={activeConcept}
            isCompleted={readCards.has(activeConceptId)}
            onMarkComplete={handleMarkComplete}
          />
        )}
      </div>
    </div>
  );
}
