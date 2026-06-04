import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ListenButton from './ListenButton';
import QuickExplainView from './QuickExplainView';
import ConceptualView from './ConceptualView';
import CodingHelpView from './CodingHelpView';
import { SIMULATION_CONFIG } from '../../config/simulationConfig';

// ============================================
// PROFESSIONAL CONTENT BLOCK LABELS
// ============================================

const BLOCK_TYPES = {
  concept: { label: 'Overview' },
  code: { label: 'Code Example' },
  mistake: { label: 'Common Pitfall' },
  comparison: { label: 'Comparison' },
  challenge: { label: 'Exercise' },
  insight: { label: 'Key Insight' },
};

const DIFFICULTY_LABELS = {
  high: 'Advanced',
  medium: 'Intermediate',
  foundational: 'Beginner',
};

// ============================================
// HIGHLIGHT UTILITIES
// ============================================

function getHighlightStorageKey(topic) {
  return `visualearn_highlights_${topic || 'default'}`;
}

function loadHighlights(topic) {
  try {
    const stored = localStorage.getItem(getHighlightStorageKey(topic));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHighlights(topic, highlights) {
  try {
    localStorage.setItem(getHighlightStorageKey(topic), JSON.stringify(highlights));
  } catch {
    console.error('Failed to save highlights');
  }
}

// ============================================
// SELECTION POPUP COMPONENT
// ============================================

function SelectionPopup({ position, onHighlight, onClose }) {
  const popupRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position) return null;

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      style={{ top: position.y - 40, left: position.x }}
      className="fixed z-50 bg-foreground text-background px-3 py-1.5 rounded-md shadow-lg"
    >
      <button
        onClick={onHighlight}
        className="text-xs font-medium hover:opacity-80 transition-opacity"
      >
        Highlight
      </button>
    </motion.div>
  );
}

// ============================================
// HIGHLIGHTED TEXT COMPONENT
// ============================================

function HighlightedText({ text, highlights, blockId, onRemoveHighlight }) {
  if (!highlights || highlights.length === 0 || !text) {
    return <span>{text}</span>;
  }

  // Filter highlights for this block
  const blockHighlights = highlights.filter(h => h.blockId === blockId);
  if (blockHighlights.length === 0) {
    return <span>{text}</span>;
  }

  // Sort highlights by start position
  const sorted = [...blockHighlights].sort((a, b) => a.start - b.start);

  const parts = [];
  let lastEnd = 0;

  sorted.forEach((highlight, idx) => {
    // Add text before highlight
    if (highlight.start > lastEnd) {
      parts.push(
        <span key={`text-${idx}`}>{text.slice(lastEnd, highlight.start)}</span>
      );
    }
    // Add highlighted text
    parts.push(
      <mark
        key={`highlight-${idx}`}
        className="bg-yellow-200 dark:bg-yellow-500/30 cursor-pointer px-0.5 rounded-sm"
        onClick={() => onRemoveHighlight?.(highlight.id)}
        title="Click to remove highlight"
      >
        {text.slice(highlight.start, highlight.end)}
      </mark>
    );
    lastEnd = highlight.end;
  });

  // Add remaining text
  if (lastEnd < text.length) {
    parts.push(<span key="text-end">{text.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

// ============================================
// CODE BLOCK WITH EXECUTION
// ============================================

function CodeBlock({ code, language, explanation, title }) {
  const [showPreview, setShowPreview] = useState(false);
  const [editedCode, setEditedCode] = useState(code || '');
  const [output, setOutput] = useState('');
  const iframeRef = useRef(null);

  // Run JavaScript code and capture console.log output
  const runJavaScript = useCallback((codeToRun) => {
    const logs = [];
    const sandboxConsole = {
      log: (...args) => logs.push(args.map(arg => {
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
        }
        return String(arg);
      }).join(' ')),
      error: (...args) => logs.push('Error: ' + args.map(String).join(' ')),
      warn: (...args) => logs.push('Warning: ' + args.map(String).join(' ')),
      info: (...args) => logs.push(args.map(String).join(' ')),
    };

    try {
      // Create a function that takes our custom console
      const fn = new Function('console', codeToRun);
      fn(sandboxConsole);
    } catch (e) {
      logs.push('Error: ' + e.message);
    }

    return logs.length > 0 ? logs.join('\n') : 'No output (code ran successfully but produced no console.log statements)';
  }, []);

  const runCode = useCallback(() => {
    const lang = language?.toLowerCase();

    if (lang === 'javascript' || lang === 'js') {
      // Execute JS and capture console output
      const result = runJavaScript(editedCode);
      setOutput(result);
      setShowPreview(true);
    } else if (lang === 'html') {
      // For HTML, use iframe
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(editedCode);
          doc.close();
        }
      }
      setOutput('');
      setShowPreview(true);
    }
  }, [editedCode, language, runJavaScript]);

  const canExecute = ['html', 'javascript', 'js'].includes(language?.toLowerCase());
  const isJavaScript = ['javascript', 'js'].includes(language?.toLowerCase());

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

      {/* Preview / Output */}
      {showPreview && canExecute && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              {isJavaScript ? 'Console Output' : 'Preview'}
            </span>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {isJavaScript ? (
            // JavaScript: Show console output as text
            <pre className="p-4 bg-zinc-900 text-zinc-100 font-mono text-sm min-h-[80px] max-h-[200px] overflow-auto whitespace-pre-wrap">
              {output || 'No output'}
            </pre>
          ) : (
            // HTML: Use iframe
            <iframe
              ref={iframeRef}
              title="Code Preview"
              className="w-full h-40 bg-white"
              sandbox="allow-scripts"
            />
          )}
        </motion.div>
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
    <div className="space-y-4">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wrong */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Avoid</p>
          <pre className="p-4 bg-muted/50 border border-border rounded-md text-sm font-mono text-foreground overflow-x-auto">
            {wrong}
          </pre>
        </div>

        {/* Right */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prefer</p>
          <pre className="p-4 bg-muted/50 border border-border rounded-md text-sm font-mono text-foreground overflow-x-auto">
            {right}
          </pre>
        </div>
      </div>

      {why && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Note:</span> {why}
        </p>
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

function ContentBlock({
  block,
  index = 0,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
  onRegenerateBlock,
  isRegenerating = false,
  conceptId
}) {
  const config = BLOCK_TYPES[block.type] || BLOCK_TYPES.concept;
  const blockId = `${conceptId}-${index}`;
  const [selectionPopup, setSelectionPopup] = useState(null);
  const contentRef = useRef(null);

  // Handle text selection for highlighting
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) {
      setSelectionPopup(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setSelectionPopup(null);
      return;
    }

    // Check if selection is within this content block
    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      setSelectionPopup(null);
      return;
    }

    // Get position for popup
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      x: rect.left + rect.width / 2 - 30,
      y: rect.top,
      text: selectedText,
      range,
    });
  }, []);

  const handleHighlight = useCallback(() => {
    if (!selectionPopup || !block.content) return;

    const { text } = selectionPopup;
    const content = block.content || '';
    const start = content.indexOf(text);

    if (start !== -1) {
      onAddHighlight?.({
        id: Date.now().toString(),
        blockId,
        text,
        start,
        end: start + text.length,
      });
    }

    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  }, [selectionPopup, block.content, blockId, onAddHighlight]);

  const canRegenerate = block.type === 'concept' || block.type === 'insight';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="border-b border-border pb-6 last:border-0 last:pb-0"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {config.label}
        </p>
        {canRegenerate && onRegenerateBlock && (
          <button
            onClick={() => onRegenerateBlock(block, index)}
            disabled={isRegenerating}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isRegenerating ? 'Regenerating...' : 'Explain differently'}
          </button>
        )}
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
        <div ref={contentRef} onMouseUp={handleMouseUp}>
          {block.title && <h4 className="text-sm font-semibold text-foreground mb-2">{block.title}</h4>}
          <p className="text-sm text-muted-foreground leading-relaxed select-text">
            <HighlightedText
              text={block.content}
              highlights={highlights}
              blockId={blockId}
              onRemoveHighlight={onRemoveHighlight}
            />
          </p>
        </div>
      )}

      <AnimatePresence>
        {selectionPopup && (
          <SelectionPopup
            position={selectionPopup}
            onHighlight={handleHighlight}
            onClose={() => setSelectionPopup(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// SIDEBAR CONCEPT ITEM
// ============================================

function SidebarItem({ idea, isActive, isCompleted, onClick, index }) {
  const difficultyLabel = DIFFICULTY_LABELS[idea.difficulty] || DIFFICULTY_LABELS.foundational;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 transition-colors ${
        isActive
          ? 'bg-muted'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-baseline gap-3">
        <span className={`text-xs font-medium tabular-nums ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isCompleted ? 'text-muted-foreground' : isActive ? 'font-medium text-foreground' : 'text-foreground'}`}>
            {idea.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {difficultyLabel}{idea.time_estimate ? ` · ${idea.time_estimate} min` : ''}
          </p>
        </div>
        {isCompleted && (
          <span className="text-xs text-muted-foreground">Done</span>
        )}
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
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
      {skillAreas.slice(0, 4).map((area, idx) => {
        const completed = area.concepts?.filter(c => completedIds.has(c)).length || 0;
        const total = area.concepts?.length || 1;
        const percent = Math.round((completed / total) * 100);

        return (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{area.name}</span>
              <span className="text-xs text-muted-foreground">{percent}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-foreground/40 rounded-full"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ============================================
// MAIN CONTENT AREA
// ============================================

function MainContent({
  idea,
  isCompleted,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  onRegenerateBlock,
  regeneratingBlockIndex
}) {
  const difficultyLabel = DIFFICULTY_LABELS[idea?.difficulty] || DIFFICULTY_LABELS.foundational;
  const blocks = idea?.blocks || [];

  // Generate fallback blocks if none exist
  const displayBlocks = blocks.length > 0 ? blocks : [
    { type: 'concept', title: 'Overview', content: idea?.explanation || 'No content available.' }
  ];

  // Extract text content for TTS
  const getReadableContent = useCallback(() => {
    if (!idea) return '';
    let text = idea.title + '. ';
    if (idea.subtitle) text += idea.subtitle + '. ';

    displayBlocks.forEach(block => {
      if (block.title) text += block.title + '. ';
      if (block.content) text += block.content + '. ';
      if (block.explanation) text += block.explanation + '. ';
    });

    if (idea.analogy) text += 'Think of it like: ' + idea.analogy + '. ';
    return text;
  }, [idea, displayBlocks]);

  if (!idea) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">Select a concept to begin</p>
      </div>
    );
  }

  const readableText = getReadableContent();

  return (
    <article className="space-y-8">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{difficultyLabel}</span>
            {idea.time_estimate && (
              <>
                <span>·</span>
                <span>{idea.time_estimate} min read</span>
              </>
            )}
          </div>
          {/* Listen Button - prominently placed */}
          <ListenButton text={readableText} variant="default" />
        </div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{idea.title}</h2>
        {idea.subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{idea.subtitle}</p>
        )}
      </header>

      {/* Content Blocks */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idea?.id || 'default'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {displayBlocks.map((block, idx) => (
            <ContentBlock
              key={idx}
              block={block}
              index={idx}
              conceptId={idea.id}
              highlights={highlights}
              onAddHighlight={onAddHighlight}
              onRemoveHighlight={onRemoveHighlight}
              onRegenerateBlock={onRegenerateBlock}
              isRegenerating={regeneratingBlockIndex === idx}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Legacy analogy support */}
      {idea.analogy && !blocks.some(b => b.type === 'insight') && (
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Analogy
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{idea.analogy}</p>
        </div>
      )}

      {/* Completed indicator */}
      {isCompleted && (
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          Section completed
        </p>
      )}
    </article>
  );
}

// ============================================
// COMPLETION STATE
// ============================================

function CompletionState({ topic, nextTopics = [], onGoToQuiz, onGoToFlashcards }) {
  return (
    <div className="space-y-6">
      <div className="py-8">
        <h2 className="text-lg font-semibold text-foreground">All concepts complete</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You've finished reviewing {topic || 'this section'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Continue with</p>
        <div className="flex gap-3">
          <button
            onClick={onGoToFlashcards}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
          >
            Flashcards
          </button>
          <button
            onClick={onGoToQuiz}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
          >
            Quiz
          </button>
        </div>
      </div>

      {nextTopics && nextTopics.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Related topics</p>
          <p className="text-sm text-foreground">
            {nextTopics.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SMART SUGGESTIONS (MEMOIZED)
// ============================================

// Suggestion configurations aligned with cognitive states
const SUGGESTION_CONFIG = {
  struggling: {
    primaryText: "Take your time. A mind map can make this easier to scan.",
    primaryAction: 'mindmap',
    primaryLabel: 'View Mind Map',
    tone: 'supportive',
  },
  confused: {
    primaryText: "Let's try a different approach. Visual aids might help.",
    primaryAction: 'mindmap',
    primaryLabel: 'View Mind Map',
    tone: 'supportive',
  },
  flow: {
    primaryText: "You're making good progress. Ready to test your understanding?",
    primaryAction: 'quiz',
    primaryLabel: 'Take a Quick Quiz',
    tone: 'neutral',
  },
  bored: {
    primaryText: "Ready for a challenge? Test what you know.",
    primaryAction: 'quiz',
    primaryLabel: 'Challenge Yourself',
    tone: 'challenging',
  },
  mastering: {
    primaryText: "Excellent progress. Push yourself with the quiz.",
    primaryAction: 'quiz',
    primaryLabel: 'Test Your Mastery',
    tone: 'challenging',
  },
};

const SmartSuggestions = memo(function SmartSuggestions({
  onOpenTab,
  progress,
  allCompleted,
  cognitiveState,
  showSimulationHint = false,
  simulationType = null,
}) {
  if (!onOpenTab) return null;

  // Get suggestion config based on cognitive state, with fallback
  const config = SUGGESTION_CONFIG[cognitiveState] || SUGGESTION_CONFIG.flow;

  // Determine if we should show the primary suggestion
  // - Don't show if user just started (progress < 20%)
  // - Always show if completed
  const showPrimarySuggestion = progress >= 20 || allCompleted;

  // For struggling/confused states, show supportive suggestions regardless of progress
  const isNeedingSupport = cognitiveState === 'struggling' || cognitiveState === 'confused';

  return (
    <div className="mt-8 pt-6 border-t border-border">
      {/* Primary suggestion - context and state aware */}
      {(showPrimarySuggestion || isNeedingSupport) && !allCompleted && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-foreground">{config.primaryText}</p>
          <button
            onClick={() => onOpenTab(config.primaryAction)}
            className={`mt-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              config.tone === 'challenging'
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'border border-border hover:bg-muted'
            }`}
          >
            {config.primaryLabel}
          </button>
        </div>
      )}

      {/* Completion state */}
      {allCompleted && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-foreground">
            {cognitiveState === 'mastering'
              ? "You've mastered this material. Challenge yourself further."
              : "Great work completing all sections. Reinforce what you learned."}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onOpenTab('flashcards')}
              className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
            >
              Practice with Flashcards
            </button>
            <button
              onClick={() => onOpenTab('quiz')}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              Take Quiz
            </button>
          </div>
        </div>
      )}

      {/* Simulation hint for medium confidence */}
      {showSimulationHint && (
        <div className="mb-4 p-3 bg-muted/30 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            This topic might work well as a visual simulation.
          </p>
          <button
            onClick={() => onOpenTab('simulation')}
            className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Try visualizing as a simulation?
          </button>
        </div>
      )}

      {/* Secondary options - always available */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        {allCompleted ? 'More options' : 'Explore'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onOpenTab('quiz')}
          className="px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-md hover:bg-muted hover:text-foreground transition-colors"
        >
          Quiz
        </button>
        <button
          onClick={() => onOpenTab('flashcards')}
          className="px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-md hover:bg-muted hover:text-foreground transition-colors"
        >
          Flashcards
        </button>
        <button
          onClick={() => onOpenTab('mindmap')}
          className="px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-md hover:bg-muted hover:text-foreground transition-colors"
        >
          Mind Map
        </button>
      </div>
    </div>
  );
});

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
  onRegenerateBlock,
  onOpenTab, // New: handles opening tabs dynamically
  cognitiveState = 'flow', // 'struggling' | 'confused' | 'flow' | 'bored' | 'mastering'
  simulationDetection = null, // { supported, type, confidence, algorithm, reason }
  // NEW: Adaptive response mode support
  responseMode = null, // 'quick_explain' | 'deep_learn' | 'coding_help' | 'conceptual_noncs' | 'simulation'
  onExpandContent = null, // Handler for progressive disclosure (expand to deeper content)
  isExpanding = false, // Loading state when expanding content
}) {
  const [activeConceptId, setActiveConceptId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [regeneratingBlockIndex, setRegeneratingBlockIndex] = useState(null);
  const mainContentRef = useRef(null);

  // Highlight state with localStorage persistence
  const [highlights, setHighlights] = useState(() => loadHighlights(topic));

  // Update highlights when topic changes
  useEffect(() => {
    setHighlights(loadHighlights(topic));
  }, [topic]);

  // Save highlights when they change
  useEffect(() => {
    if (topic) {
      saveHighlights(topic, highlights);
    }
  }, [highlights, topic]);

  const handleAddHighlight = useCallback((highlight) => {
    setHighlights(prev => [...prev, highlight]);
  }, []);

  const handleRemoveHighlight = useCallback((highlightId) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
  }, []);

  const handleRegenerateBlock = useCallback(async (block, blockIndex) => {
    if (!onRegenerateBlock || regeneratingBlockIndex !== null) return;

    setRegeneratingBlockIndex(blockIndex);
    try {
      await onRegenerateBlock(activeConceptId, block, blockIndex);
    } finally {
      setRegeneratingBlockIndex(null);
    }
  }, [onRegenerateBlock, activeConceptId, regeneratingBlockIndex]);

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

  // Auto-mark current concept as read when navigating to another
  const handleConceptClick = useCallback((id) => {
    // Mark the current concept as read when leaving it
    if (activeConceptId && activeConceptId !== id && !readCards.has(activeConceptId)) {
      onReadCard?.(activeConceptId);
    }
    setActiveConceptId(id);
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeConceptId, readCards, onReadCard]);

  const progress = keyIdeas.length > 0
    ? Math.round((readCards.size / keyIdeas.length) * 100)
    : 0;

  const allCompleted = keyIdeas.length > 0 && readCards.size >= keyIdeas.length;

  // Simulation hint logic: show for medium confidence from shared config.
  const showSimulationHint = simulationDetection?.supported &&
    simulationDetection.confidence >= SIMULATION_CONFIG.SUGGEST_THRESHOLD &&
    simulationDetection.confidence < SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD;

  // Simulation available banner: show for high confidence auto-shown tabs.
  const showSimulationAvailable = simulationDetection?.supported &&
    simulationDetection.confidence >= SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD;

  // ============================================
  // MODE-AWARE RENDERING
  // Detect response mode and render appropriate view
  // ============================================

  // Detect responseMode from content or prop
  const detectedMode = responseMode || learningContent?.responseMode || 'deep_learn';

  // Quick Explain Mode
  if (detectedMode === 'quick_explain' && learningContent) {
    return (
      <QuickExplainView
        content={learningContent}
        topic={topic}
        onExpand={onExpandContent}
        onOpenTab={onOpenTab}
        isExpanding={isExpanding}
      />
    );
  }

  // Conceptual (Non-CS) Mode
  if (detectedMode === 'conceptual_noncs' && learningContent) {
    return (
      <ConceptualView
        content={learningContent}
        topic={topic}
        onOpenTab={onOpenTab}
      />
    );
  }

  // Coding Help Mode
  if (detectedMode === 'coding_help' && learningContent) {
    return (
      <CodingHelpView
        content={learningContent}
        topic={topic}
        onOpenTab={onOpenTab}
      />
    );
  }

  // ============================================
  // STANDARD DEEP LEARN MODE (existing behavior)
  // ============================================

  if (!keyIdeas || keyIdeas.length === 0) {
    const fallbackText = summary
      || learningContent?.answer
      || learningContent?.explanation
      || learningContent?.description
      || learningContent?.overview
      || learningContent?.key_takeaway
      || '';

    if (fallbackText) {
      return (
        <div className="rounded-lg border border-border bg-card p-5">
          {topic && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {topic}
            </p>
          )}
          <div className="space-y-3 text-sm leading-7 text-foreground">
            {String(fallbackText)
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index} className="whitespace-pre-wrap">
                  {paragraph.trim()}
                </p>
              ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No learning content available</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 border border-border rounded-md overflow-hidden md:h-[calc(100vh-200px)] md:min-h-[500px]">
      {/* Sidebar */}
      <aside className={`hidden border-r border-border flex-col transition-all md:flex ${
        sidebarCollapsed ? 'w-14' : 'w-64'
      }`}>
        {/* Sidebar Header */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contents</p>
              <p className="text-xs text-muted-foreground mt-0.5">{readCards.size} of {keyIdeas.length}</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Progress */}
        {!sidebarCollapsed && (
          <div className="px-3 py-2 border-b border-border">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-foreground/30 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Concept List */}
        {!sidebarCollapsed && (
          <nav className="flex-1 overflow-y-auto">
            {keyIdeas.map((idea, idx) => (
              <SidebarItem
                key={idea.id}
                idea={idea}
                index={idx}
                isActive={activeConceptId === idea.id}
                isCompleted={readCards.has(idea.id)}
                onClick={() => handleConceptClick(idea.id)}
              />
            ))}
          </nav>
        )}

        {/* Collapsed List */}
        {sidebarCollapsed && (
          <nav className="flex-1 overflow-y-auto py-2">
            {keyIdeas.map((idea, idx) => (
              <button
                key={idea.id}
                onClick={() => handleConceptClick(idea.id)}
                className={`w-full py-2 text-xs font-medium transition-colors ${
                  activeConceptId === idea.id
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title={idea.title}
              >
                {String(idx + 1).padStart(2, '0')}
              </button>
            ))}
          </nav>
        )}

        {/* Skill Progress */}
        {!sidebarCollapsed && skillAreas.length > 0 && (
          <div className="p-3 border-t border-border">
            <SkillProgress skillAreas={skillAreas} completedIds={readCards} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main ref={mainContentRef} className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Simulation Available Banner (high confidence) */}
        {showSimulationAvailable && (
          <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-foreground">Simulation available for this topic</span>
              </div>
              <button
                onClick={() => onOpenTab?.('simulation')}
                className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                View Simulation
              </button>
            </div>
          </div>
        )}

        {/* Overview Banner */}
        {!allCompleted && activeConceptId === keyIdeas[0]?.id && summary && (
          <div className="mb-8 pb-6 border-b border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {estimatedTime && <span>{estimatedTime} min total</span>}
              <span>{keyIdeas.length} sections</span>
              {prerequisites.length > 0 && (
                <span>Prerequisites: {prerequisites.join(', ')}</span>
              )}
            </div>
          </div>
        )}

        {/* Completion Banner */}
        {allCompleted && (
          <div className="mb-8 pb-6 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-foreground">All sections complete</p>
            </div>
            <p className="text-sm text-muted-foreground">Select any section to review, or continue with practice below.</p>
          </div>
        )}

        {/* Main Content */}
        <MainContent
          idea={activeConcept}
          isCompleted={readCards.has(activeConceptId)}
          highlights={highlights}
          onAddHighlight={handleAddHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          onRegenerateBlock={handleRegenerateBlock}
          regeneratingBlockIndex={regeneratingBlockIndex}
        />

        {highlights.length > 0 && (
          <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} saved locally
          </p>
        )}

        {/* Smart Suggestions - Memoized and aligned with cognitive state */}
        <SmartSuggestions
          onOpenTab={onOpenTab}
          progress={progress}
          allCompleted={allCompleted}
          cognitiveState={cognitiveState}
          showSimulationHint={showSimulationHint}
          simulationType={simulationDetection?.type}
        />
      </main>
    </div>
  );
}
