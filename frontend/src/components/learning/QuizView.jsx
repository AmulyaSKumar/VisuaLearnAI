import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// SCORE REACTIONS
// ============================================

function getScoreReaction(percentage) {
  if (percentage >= 90) return {
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: 'Excellent!',
    color: 'text-green-600 dark:text-green-400'
  };
  if (percentage >= 70) return {
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: 'Well done!',
    color: 'text-blue-600 dark:text-blue-400'
  };
  if (percentage >= 50) return {
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    message: 'Good effort!',
    color: 'text-yellow-600 dark:text-yellow-400'
  };
  return {
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    message: 'Keep practicing!',
    color: 'text-orange-600 dark:text-orange-400'
  };
}

// Convert letter answer to index
function letterToIndex(letter) {
  if (typeof letter === 'number') return letter;
  const normalized = String(letter).toUpperCase().trim();
  const index = normalized.charCodeAt(0) - 65;
  return index >= 0 && index < 26 ? index : 0;
}

// Question type icons
const QUESTION_TYPE_ICONS = {
  mcq: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  fill_blank: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  true_false: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  output_prediction: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  code_sandbox: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
};

const QUESTION_TYPE_LABELS = {
  mcq: 'Multiple Choice',
  fill_blank: 'Fill in the Blank',
  true_false: 'True or False',
  output_prediction: 'Predict the Output',
  code_sandbox: 'Code Challenge',
};

// ============================================
// CODE SANDBOX COMPONENT
// ============================================

function CodeSandbox({ question, onSubmit, showResult, isCorrect }) {
  const [code, setCode] = useState(question.starter_code || '');
  const [showHints, setShowHints] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);
  const iframeRef = useRef(null);

  // Update preview when code changes
  useEffect(() => {
    if (iframeRef.current && question.language === 'html') {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: system-ui, sans-serif; padding: 16px; margin: 0; background: #fff; }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>${code}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [code, question.language]);

  const handleCheck = () => {
    // Simple validation based on keywords
    const keywords = question.validation_keywords || [];
    const isValid = keywords.every(keyword =>
      code.toLowerCase().includes(keyword.toLowerCase())
    );
    onSubmit(isValid);
  };

  return (
    <div className="space-y-4">
      {/* Task Description */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-2">Task:</h4>
        <p className="text-sm text-muted-foreground">{question.task}</p>
      </div>

      {/* Editor and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Code Editor ({question.language})
            </span>
            {!showResult && question.hints?.length > 0 && (
              <button
                onClick={() => setShowHints(!showHints)}
                className="text-xs text-primary hover:underline"
              >
                {showHints ? 'Hide Hints' : 'Show Hints'}
              </button>
            )}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={showResult}
            className={`w-full h-48 p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-primary ${
              showResult
                ? isCorrect
                  ? 'border-green-500'
                  : 'border-amber-500'
                : 'border-slate-700'
            }`}
            spellCheck={false}
          />
        </div>

        {/* Live Preview */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Live Preview
          </span>
          <div className="h-48 bg-white rounded-lg border border-border overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Preview"
              className="w-full h-full"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>

      {/* Hints */}
      <AnimatePresence>
        {showHints && question.hints?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Hint {currentHint + 1} of {question.hints.length}
              </span>
              {currentHint < question.hints.length - 1 && (
                <button
                  onClick={() => setCurrentHint(currentHint + 1)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Next Hint
                </button>
              )}
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {question.hints[currentHint]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solution (shown after result) */}
      {showResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Solution
            </span>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded font-mono text-sm overflow-x-auto">
            {question.solution}
          </pre>
        </motion.div>
      )}

      {/* Submit Button */}
      {!showResult && (
        <button
          onClick={handleCheck}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Check My Code
        </button>
      )}
    </div>
  );
}

// ============================================
// FILL IN THE BLANK COMPONENT
// ============================================

function FillBlankQuestion({ question, onSubmit, showResult, isCorrect }) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    const correct = answer.trim().toLowerCase() === question.correct_answer.toLowerCase();
    onSubmit(correct);
  };

  // Parse question to show blank
  const renderQuestion = () => {
    const text = question.question;
    const parts = text.split('____');

    return (
      <div className="text-lg font-mono bg-slate-900 text-slate-100 p-4 rounded-lg">
        {parts[0]}
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={showResult}
          className={`mx-1 px-3 py-1 w-32 text-center font-mono rounded border-2 bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary ${
            showResult
              ? isCorrect
                ? 'border-green-500 text-green-400'
                : 'border-red-500 text-red-400'
              : 'border-slate-600'
          }`}
          placeholder="..."
          onKeyDown={(e) => e.key === 'Enter' && !showResult && handleSubmit()}
        />
        {parts[1]}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderQuestion()}

      {question.hint && !showResult && (
        <p className="text-sm text-muted-foreground italic">
          Hint: {question.hint}
        </p>
      )}

      {showResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 rounded-lg ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}
        >
          <p className={`text-sm font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCorrect ? 'Correct!' : `Incorrect. The answer is: ${question.correct_answer}`}
          </p>
        </motion.div>
      )}

      {!showResult && (
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            answer.trim()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}

// ============================================
// TRUE/FALSE COMPONENT
// ============================================

function TrueFalseQuestion({ question, onSubmit, showResult, userAnswer }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (value) => {
    if (showResult) return;
    setSelected(value);
  };

  const handleSubmit = () => {
    onSubmit(selected === question.correct);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-lg text-foreground">{question.statement}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[true, false].map((value) => {
          const isSelected = selected === value;
          const isCorrect = showResult && question.correct === value;
          const isWrong = showResult && selected === value && question.correct !== value;

          return (
            <button
              key={String(value)}
              onClick={() => handleSelect(value)}
              disabled={showResult}
              className={`p-4 rounded-xl border-2 font-medium transition-all ${
                isCorrect
                  ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
                  : isWrong
                    ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                    : isSelected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
              }`}
            >
              {value ? 'True' : 'False'}
            </button>
          );
        })}
      </div>

      {!showResult && (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            selected !== null
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}

// ============================================
// OUTPUT PREDICTION COMPONENT
// ============================================

function OutputPredictionQuestion({ question, onSubmit, showResult, isCorrect }) {
  const [selected, setSelected] = useState(null);
  const correctIndex = question.options.indexOf(question.correct);

  const handleSelect = (index) => {
    if (showResult) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    onSubmit(selected === correctIndex);
  };

  return (
    <div className="space-y-4">
      {/* Code Block */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          What will this code output?
        </span>
        <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-sm overflow-x-auto">
          <code>{question.code}</code>
        </pre>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectOption = showResult && index === correctIndex;
          const isWrong = showResult && isSelected && index !== correctIndex;

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showResult}
              className={`p-3 rounded-lg border-2 font-mono text-sm text-left transition-all ${
                isCorrectOption
                  ? 'border-green-500 bg-green-500/10'
                  : isWrong
                    ? 'border-red-500 bg-red-500/10'
                    : isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {!showResult && (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            selected !== null
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}

// ============================================
// MCQ COMPONENT
// ============================================

function MCQQuestion({ question, onSubmit, showResult, isCorrect }) {
  const [selected, setSelected] = useState(null);
  const correctIndex = letterToIndex(question.correct);

  const handleSelect = (index) => {
    if (showResult) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    onSubmit(selected === correctIndex);
  };

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-lg text-foreground">{question.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectOption = showResult && index === correctIndex;
          const isWrong = showResult && isSelected && index !== correctIndex;

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showResult}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isCorrectOption
                  ? 'border-green-500 bg-green-500/10'
                  : isWrong
                    ? 'border-red-500 bg-red-500/10'
                    : isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                  isCorrectOption
                    ? 'bg-green-500 text-white'
                    : isWrong
                      ? 'bg-red-500 text-white'
                      : isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                }`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {!showResult && (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            selected !== null
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}

// ============================================
// EXPLANATION PANEL
// ============================================

function ExplanationPanel({ question, isCorrect }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Result Banner */}
      <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </span>
        </div>
      </div>

      {/* Why? Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {showDetails ? 'Hide Explanation' : 'Why?'}
      </button>

      {/* Detailed Explanation */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {/* Main Explanation */}
            {question.explanation && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                      Explanation
                    </p>
                    <p className="text-sm text-foreground">{question.explanation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Why It Matters */}
            {question.why_it_matters && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                      Why It Matters
                    </p>
                    <p className="text-sm text-foreground">{question.why_it_matters}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Code Example */}
            {question.code_example && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  Example
                </p>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded font-mono text-sm overflow-x-auto">
                  {question.code_example}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// MAIN QUIZ VIEW
// ============================================

const questionVariants = {
  enter: { opacity: 0, x: 50 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

export default function QuizView({
  quiz,
  userId,
  onInteraction,
  onBackToLearn,
  updateConceptMastery,
  recordQuizResult,
  topic
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentIsCorrect, setCurrentIsCorrect] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [retryQuestionIndices, setRetryQuestionIndices] = useState([]);
  const [retryIndex, setRetryIndex] = useState(0);

  // Handle both new flat array format and old nested format
  const allQuestions = Array.isArray(quiz) ? quiz : (quiz?.questions || []);

  // In retry mode, use only the retry questions; otherwise use all
  const questions = retryMode ? retryQuestionIndices.map(i => allQuestions[i]) : allQuestions;
  const actualQuestionIndex = retryMode ? retryQuestionIndices[currentQuestion] : currentQuestion;

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p>No quiz available</p>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const questionType = question.type || 'mcq';
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleAnswer = (isCorrect) => {
    setShowResult(true);
    setCurrentIsCorrect(isCorrect);

    // Store answer with question index reference
    const questionIdx = retryMode ? retryQuestionIndices[currentQuestion] : currentQuestion;
    setAnswers((prev) => ({
      ...prev,
      [questionIdx]: { isCorrect, attempts: (prev[questionIdx]?.attempts || 0) + 1 }
    }));

    // Update concept mastery if available
    const conceptId = question.concept_id || `quiz_q${questionIdx}`;
    if (updateConceptMastery) {
      updateConceptMastery(conceptId, isCorrect, questionType);
    }

    onInteraction?.({
      type: 'quiz_answer',
      questionIndex: questionIdx,
      questionType,
      isCorrect,
      isRetry: retryMode
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowResult(false);
      setCurrentIsCorrect(false);
    } else {
      // Quiz completed - record result
      if (recordQuizResult && !retryMode) {
        const score = getScore();
        recordQuizResult({
          topic,
          questions: allQuestions,
          answers,
          score: score.correct
        });
      }
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setShowResult(false);
    setAnswers({});
    setIsCompleted(false);
    setCurrentIsCorrect(false);
    setRetryMode(false);
    setRetryQuestionIndices([]);
  };

  const handleRetryIncorrect = () => {
    // Find all incorrect answers
    const incorrectIndices = [];
    Object.entries(answers).forEach(([idx, answer]) => {
      if (!answer.isCorrect) {
        incorrectIndices.push(parseInt(idx));
      }
    });

    if (incorrectIndices.length === 0) return;

    setRetryMode(true);
    setRetryQuestionIndices(incorrectIndices);
    setCurrentQuestion(0);
    setShowResult(false);
    setIsCompleted(false);
    setCurrentIsCorrect(false);
  };

  const getScore = () => {
    // For retry mode, count based on allQuestions
    const totalQuestions = retryMode ? allQuestions.length : questions.length;
    const correct = Object.values(answers).filter((a) => a.isCorrect).length;
    return {
      correct,
      total: totalQuestions,
      percentage: Math.round((correct / totalQuestions) * 100),
      incorrect: totalQuestions - correct
    };
  };

  // Render question based on type
  const renderQuestion = () => {
    switch (questionType) {
      case 'fill_blank':
        return (
          <FillBlankQuestion
            question={question}
            onSubmit={handleAnswer}
            showResult={showResult}
            isCorrect={currentIsCorrect}
          />
        );
      case 'true_false':
        return (
          <TrueFalseQuestion
            question={question}
            onSubmit={handleAnswer}
            showResult={showResult}
          />
        );
      case 'output_prediction':
        return (
          <OutputPredictionQuestion
            question={question}
            onSubmit={handleAnswer}
            showResult={showResult}
            isCorrect={currentIsCorrect}
          />
        );
      case 'code_sandbox':
        return (
          <CodeSandbox
            question={question}
            onSubmit={handleAnswer}
            showResult={showResult}
            isCorrect={currentIsCorrect}
          />
        );
      case 'mcq':
      default:
        return (
          <MCQQuestion
            question={question}
            onSubmit={handleAnswer}
            showResult={showResult}
            isCorrect={currentIsCorrect}
          />
        );
    }
  };

  // Completed State
  if (isCompleted) {
    const score = getScore();
    const reaction = getScoreReaction(score.percentage);
    const hasIncorrect = score.incorrect > 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8 space-y-6"
      >
        {/* Retry Mode Badge */}
        {retryMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Round Complete
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ${reaction.color}`}
        >
          {reaction.icon}
        </motion.div>

        <div>
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-2xl font-bold ${reaction.color}`}
          >
            {reaction.message}
          </motion.h3>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2"
          >
            <span className="text-4xl font-bold text-foreground">{score.percentage}%</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground mt-1"
          >
            You got {score.correct} out of {score.total} questions correct
          </motion.p>
        </div>

        {/* Score breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-8"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{score.correct}</div>
            <div className="text-xs text-muted-foreground">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{score.incorrect}</div>
            <div className="text-xs text-muted-foreground">Incorrect</div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center gap-3 flex-wrap"
        >
          {/* Retry Incorrect - shown only if there are incorrect answers */}
          {hasIncorrect && (
            <button
              onClick={handleRetryIncorrect}
              className="px-6 py-2 min-h-[44px] bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-500/90 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry {score.incorrect} Incorrect
            </button>
          )}
          <button
            onClick={handleRestart}
            className="px-6 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Restart Quiz
          </button>
          {onBackToLearn && (
            <button
              onClick={onBackToLearn}
              className="px-6 py-2 min-h-[44px] bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
            >
              Back to Learn
            </button>
          )}
        </motion.div>

        {/* Mastery Tip */}
        {hasIncorrect && !retryMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-md mx-auto"
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Learning Tip</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Retrying incorrect questions helps strengthen your memory. The concepts you struggle with will be tracked for review.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Retry Mode Banner */}
      {retryMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
        >
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Retry Mode - {retryQuestionIndices.length} questions
            </p>
            <p className="text-xs text-muted-foreground">
              Working through the questions you got wrong
            </p>
          </div>
          <button
            onClick={handleRestart}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            Exit Retry
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        {/* Progress */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className={`h-full ${retryMode ? 'bg-amber-500' : 'bg-primary'}`}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentQuestion + 1}/{questions.length}
          </span>
        </div>

        {/* Question Type Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
          <span className="text-muted-foreground">
            {QUESTION_TYPE_ICONS[questionType] || QUESTION_TYPE_ICONS.mcq}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {QUESTION_TYPE_LABELS[questionType] || 'Question'}
          </span>
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          variants={questionVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {renderQuestion()}
        </motion.div>
      </AnimatePresence>

      {/* Explanation Panel */}
      {showResult && (
        <ExplanationPanel question={question} isCorrect={currentIsCorrect} />
      )}

      {/* Next Button */}
      {showResult && (
        <div className="flex justify-end">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleNext}
            className="px-6 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            {currentQuestion < questions.length - 1 ? (
              <>
                Next Question
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              'See Results'
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}
