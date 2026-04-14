import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

// Convert letter answer (A, B, C, D) to index
function letterToIndex(letter) {
  if (typeof letter === 'number') return letter;
  const normalized = String(letter).toUpperCase().trim();
  const index = normalized.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
  return index >= 0 && index < 26 ? index : 0;
}

const questionVariants = {
  enter: { opacity: 0, x: 50 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

export default function QuizView({ quiz, userId, onInteraction, onBackToLearn }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);

  // Handle both new flat array format and old nested format
  const questions = Array.isArray(quiz) ? quiz : (quiz?.questions || []);

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
  const correctIndex = letterToIndex(question.correct);
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleSelectAnswer = (index) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === correctIndex;
    setShowResult(true);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion]: {
        selected: selectedAnswer,
        correct: correctIndex,
        isCorrect
      }
    }));

    onInteraction?.({
      type: 'quiz_answer',
      questionIndex: currentQuestion,
      isCorrect
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers({});
    setIsCompleted(false);
  };

  const getScore = () => {
    const correct = Object.values(answers).filter((a) => a.isCorrect).length;
    return { correct, total: questions.length, percentage: Math.round((correct / questions.length) * 100) };
  };

  // Completed State
  if (isCompleted) {
    const score = getScore();
    const reaction = getScoreReaction(score.percentage);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8 space-y-6"
      >
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
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{score.total - score.correct}</div>
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
          <button
            onClick={handleRestart}
            className="px-6 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Retry Quiz
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
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-primary"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Question {currentQuestion + 1} of {questions.length}
        </span>
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
          className="bg-muted/30 rounded-xl p-6"
        >
          <h4 className="text-lg font-medium text-foreground leading-relaxed">
            {question.question}
          </h4>
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === correctIndex;
            const showCorrect = showResult && isCorrect;
            const showWrong = showResult && isSelected && !isCorrect;

            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelectAnswer(index)}
                disabled={showResult}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all min-h-[56px] ${
                  showCorrect
                    ? 'border-green-500 bg-green-500/10'
                    : showWrong
                      ? 'border-red-500 bg-red-500/10'
                      : isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    showCorrect
                      ? 'bg-green-500 text-white'
                      : showWrong
                        ? 'bg-red-500 text-white'
                        : isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                  }`}>
                    {showCorrect ? '✓' : showWrong ? '✗' : String.fromCharCode(65 + index)}
                  </span>
                  <span className={`flex-1 ${showCorrect ? 'text-green-600 dark:text-green-400' : showWrong ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {option}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Explanation */}
      <AnimatePresence>
        {showResult && question.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl overflow-hidden"
          >
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-foreground">{question.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button */}
      <div className="flex justify-end">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            className={`px-6 py-2 min-h-[44px] rounded-lg font-medium transition-colors ${
              selectedAnswer === null
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            Check Answer
          </button>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleNext}
            className="px-6 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
          </motion.button>
        )}
      </div>
    </div>
  );
}
