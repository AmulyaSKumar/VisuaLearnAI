import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// SCORE REACTIONS
// ============================================

function getScoreReaction(percentage) {
  if (percentage >= 90) return { message: 'Excellent result', level: 'high' };
  if (percentage >= 70) return { message: 'Good performance', level: 'good' };
  if (percentage >= 50) return { message: 'Passing score', level: 'pass' };
  return { message: 'Needs more practice', level: 'low' };
}

// Convert letter answer to index
function letterToIndex(letter) {
  if (typeof letter === 'number') return letter;
  const normalized = String(letter).toUpperCase().trim();
  const index = normalized.charCodeAt(0) - 65;
  return index >= 0 && index < 26 ? index : 0;
}

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentIsCorrect, setCurrentIsCorrect] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [retryQuestionIndices, setRetryQuestionIndices] = useState([]);

  // Handle both new flat array format and old nested format
  const allQuestions = Array.isArray(quiz) ? quiz : (quiz?.questions || []);

  // In retry mode, use only the retry questions; otherwise use all
  const questions = retryMode ? retryQuestionIndices.map(i => allQuestions[i]) : allQuestions;

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

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
  const shellClassName = isFullscreen
    ? 'fixed inset-0 z-[9999] overflow-y-auto bg-background p-4 sm:p-8'
    : 'relative';
  const innerClassName = isFullscreen
    ? 'flex min-h-[calc(100dvh-2rem)] w-full flex-col justify-center bg-background p-5 sm:min-h-[calc(100dvh-4rem)] sm:p-8'
    : 'space-y-6';
  const fullscreenButton = (
    <button
      type="button"
      onClick={() => setIsFullscreen(value => !value)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label={isFullscreen ? 'Exit full screen quiz' : 'Open quiz full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
    >
      {isFullscreen ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v5H3" />
          <path d="M16 3v5h5" />
          <path d="M8 21v-5H3" />
          <path d="M16 21v-5h5" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8V3h5" />
          <path d="M21 8V3h-5" />
          <path d="M3 16v5h5" />
          <path d="M21 16v5h-5" />
        </svg>
      )}
    </button>
  );

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
      <div className={shellClassName}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${innerClassName} py-8 space-y-8`}
        >
        <div className="flex justify-end">{fullscreenButton}</div>

        <div className="text-center">
          <p className="text-5xl font-semibold text-foreground tabular-nums">{score.percentage}%</p>
          <p className="text-sm text-muted-foreground mt-2">{reaction.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {score.correct} of {score.total} correct
          </p>
        </div>

        {/* Score breakdown */}
        <div className="flex justify-center gap-8 text-center">
          <div>
            <p className="text-lg font-medium text-foreground">{score.correct}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">{score.incorrect}</p>
            <p className="text-xs text-muted-foreground">Incorrect</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3 pt-4">
          {hasIncorrect && (
            <button
              onClick={handleRetryIncorrect}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              Retry incorrect ({score.incorrect})
            </button>
          )}
          <button
            onClick={handleRestart}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
          >
            Start over
          </button>
          {onBackToLearn && (
            <button
              onClick={onBackToLearn}
              className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
            >
              Back to Learn
            </button>
          )}
        </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <div className={innerClassName}>
      {/* Retry Mode Banner */}
      {retryMode && (
        <div className="flex items-center justify-between py-2 border-b border-border">
          <p className="text-sm text-muted-foreground">
            Retrying {retryQuestionIndices.length} questions
          </p>
          <button
            onClick={handleRestart}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {currentQuestion + 1} / {questions.length}
          </span>
          <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.2 }}
              className="h-full bg-foreground/30"
            />
          </div>
        </div>

        {fullscreenButton}
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

      {/* Result */}
      {showResult && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`pt-4 text-sm font-medium ${currentIsCorrect ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {currentIsCorrect ? 'Correct' : 'Incorrect'}
        </motion.p>
      )}

      {/* Next Button */}
      {showResult && (
        <div className="flex justify-end pt-4">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleNext}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
          >
            {currentQuestion < questions.length - 1 ? 'Next' : 'See Results'}
          </motion.button>
        </div>
      )}
      </div>
    </div>
  );
}
