/**
 * VARK Learning Style Onboarding Quiz
 * 10-question quiz to detect learning style on first login
 * @module components/OnboardingQuiz
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getShuffledQuestions,
  calculateVARKScores,
  VARK_DESCRIPTIONS,
} from '../data/varkQuiz';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Progress Bar Component
 */
function ProgressBar({ current, total }) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full mb-8" role="progressbar" aria-valuenow={current} aria-valuemin="0" aria-valuemax={total}>
      <div className="flex justify-between text-sm text-muted-foreground mb-2">
        <span>Question {current} of {total}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Option Card Component
 */
function OptionCard({ option, index, selected, onSelect, disabled }) {
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <button
      onClick={() => onSelect(option)}
      disabled={disabled}
      className={`
        w-full p-3 sm:p-4 min-h-[56px] rounded-xl border-2 text-left transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-pressed={selected}
      aria-label={`Option ${letters[index]}: ${option.text}`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <span className={`
          w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0
          ${selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}
        `}>
          {letters[index]}
        </span>
        <span className="text-sm md:text-base">{option.text}</span>
      </div>
    </button>
  );
}

/**
 * Question Card Component
 */
function QuestionCard({ question, questionNumber, onAnswer, selectedAnswer, isAnimating, direction }) {
  return (
    <div
      className={`
        transition-all duration-300 ease-out
        ${isAnimating
          ? direction === 'next'
            ? '-translate-x-full opacity-0'
            : 'translate-x-full opacity-0'
          : 'translate-x-0 opacity-100'
        }
      `}
    >
      <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-6">
        {question.question}
      </h2>

      <div className="space-y-3" role="radiogroup" aria-label={`Question ${questionNumber}`}>
        {question.options.map((option, index) => (
          <OptionCard
            key={`${question.id}-${index}`}
            option={option}
            index={index}
            selected={selectedAnswer?.text === option.text}
            onSelect={onAnswer}
            disabled={false}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Results Screen Component
 */
function ResultsScreen({ results, onComplete }) {
  const { dominant, percentages, description } = results;

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="text-center animate-in fade-in duration-500">
      {/* Success Icon */}
      <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Result Title */}
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
        You're primarily a {description.name} learner!
      </h2>

      {/* Short Description */}
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {description.shortDescription}
      </p>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-2xl mx-auto">
        {Object.entries(percentages).map(([style, percent]) => (
          <div
            key={style}
            className={`p-4 rounded-xl ${style === dominant ? 'bg-primary/10 border-2 border-primary' : 'bg-muted'}`}
          >
            <div className={`text-2xl font-bold ${style === dominant ? 'text-primary' : 'text-foreground'}`}>
              {percent}%
            </div>
            <div className="text-sm text-muted-foreground capitalize">{style}</div>
          </div>
        ))}
      </div>

      {/* Tips Preview */}
      <div className="bg-card border border-border rounded-xl p-4 text-left max-w-md mx-auto mb-6">
        <h3 className="font-semibold text-foreground mb-2">Quick Tips:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          {description.tips.slice(0, 2).map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Redirect Message */}
      <p className="text-sm text-muted-foreground">
        Redirecting to your personalized learning experience...
      </p>
    </div>
  );
}

/**
 * Main OnboardingQuiz Component
 */
export default function OnboardingQuiz() {
  const navigate = useNavigate();
  const { user, getAccessToken } = useAuth();

  const [questions] = useState(() => getShuffledQuestions());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState('next');
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);

  const currentQuestion = questions[currentIndex];
  const currentResponse = responses.find(r => r.questionId === currentQuestion?.id);

  /**
   * Handle answer selection
   */
  const handleAnswer = useCallback((option) => {
    if (isAnimating || isSubmitting) return;

    // Update responses
    setResponses(prev => {
      const existing = prev.findIndex(r => r.questionId === currentQuestion.id);
      const newResponse = { questionId: currentQuestion.id, style: option.style, text: option.text };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResponse;
        return updated;
      }
      return [...prev, newResponse];
    });

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        goToNext();
      }
    }, 300);
  }, [currentIndex, currentQuestion, questions.length, isAnimating, isSubmitting]);

  /**
   * Go to next question
   */
  const goToNext = useCallback(() => {
    if (currentIndex >= questions.length - 1 || isAnimating) return;

    setAnimationDirection('next');
    setIsAnimating(true);

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  }, [currentIndex, questions.length, isAnimating]);

  /**
   * Go to previous question
   */
  const goToPrevious = useCallback(() => {
    if (currentIndex <= 0 || isAnimating) return;

    setAnimationDirection('prev');
    setIsAnimating(true);

    setTimeout(() => {
      setCurrentIndex(prev => prev - 1);
      setIsAnimating(false);
    }, 300);
  }, [currentIndex, isAnimating]);

  /**
   * Submit quiz results
   */
  const handleSubmit = useCallback(async () => {
    if (responses.length < questions.length || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate results
      const quizResults = calculateVARKScores(responses);
      setResults(quizResults);

      // Submit to backend
      const token = await getAccessToken();
      if (token && user?.id) {
        const response = await fetch(`${API_BASE}/api/user/${user.id}/onboarding-quiz`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            responses: responses.map(r => ({
              questionId: r.questionId,
              style: r.style,
            })),
          }),
        });

        if (!response.ok) {
          console.error('Failed to save quiz results:', response.statusText);
          // Continue anyway - show results even if save fails
        }
      }

      setIsComplete(true);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      // Still show results even if API fails
      const quizResults = calculateVARKScores(responses);
      setResults(quizResults);
      setIsComplete(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [responses, questions.length, isSubmitting, getAccessToken, user]);

  /**
   * Handle completion redirect
   */
  const handleComplete = useCallback(() => {
    navigate('/chat/new');
  }, [navigate]);

  /**
   * Keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isComplete || isAnimating || isSubmitting) return;

      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          if (currentResponse) goToNext();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          const index = parseInt(e.key) - 1;
          if (currentQuestion?.options[index]) {
            handleAnswer(currentQuestion.options[index]);
          }
          break;
        case 'Enter':
          if (currentIndex === questions.length - 1 && responses.length === questions.length) {
            handleSubmit();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isComplete, isAnimating, isSubmitting, currentIndex, currentResponse, currentQuestion,
    questions.length, responses.length, goToPrevious, goToNext, handleAnswer, handleSubmit
  ]);

  // Show results screen
  if (isComplete && results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <ResultsScreen results={results} onComplete={handleComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div ref={containerRef} className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Discover Your Learning Style
          </h1>
          <p className="text-muted-foreground">
            Answer these questions to personalize your learning experience
          </p>
        </div>

        {/* Progress */}
        <ProgressBar current={currentIndex + 1} total={questions.length} />

        {/* Question */}
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 overflow-hidden">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            onAnswer={handleAnswer}
            selectedAnswer={currentResponse}
            isAnimating={isAnimating}
            direction={animationDirection}
          />
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0 || isAnimating}
            className={`
              px-3 sm:px-4 py-2 min-h-[44px] rounded-lg flex items-center gap-1.5 sm:gap-2 transition-colors text-sm sm:text-base
              ${currentIndex === 0 || isAnimating
                ? 'text-muted-foreground cursor-not-allowed'
                : 'text-foreground hover:bg-muted'
              }
            `}
            aria-label="Previous question"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={responses.length < questions.length || isSubmitting}
              className={`
                px-4 sm:px-6 py-2 min-h-[44px] rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all text-sm sm:text-base
                ${responses.length < questions.length || isSubmitting
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
                }
              `}
              aria-label="Submit quiz"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  See Results
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={!currentResponse || isAnimating}
              className={`
                px-3 sm:px-4 py-2 min-h-[44px] rounded-lg flex items-center gap-1.5 sm:gap-2 transition-colors text-sm sm:text-base
                ${!currentResponse || isAnimating
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'text-foreground hover:bg-muted'
                }
              `}
              aria-label="Next question"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <span className="hidden md:inline">
            Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1-4</kbd> to select,{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> to navigate
          </span>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
