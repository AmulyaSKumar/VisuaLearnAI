import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateSM2,
  isDueForReview,
  sortCardsByPriority,
  getCardStatus,
  getDueDescription,
  getIntervalPreviews,
  QUALITY_MAPPINGS,
  SM2_DEFAULTS,
} from '../../utils/spacedRepetition';
import {
  getFlashcardProgress,
  updateFlashcardProgress,
  updateStudyStreak,
} from '../../lib/supabase';

// Helper to safely extract string from potentially nested object
function extractString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && !Array.isArray(value)) {
    const textFields = ['text', 'content', 'value', 'label', 'name', 'title', 'front', 'back', 'question', 'answer'];
    for (const field of textFields) {
      if (value[field] && typeof value[field] === 'string') {
        return value[field];
      }
    }
  }
  return fallback;
}

// Truncate text helper
function truncateText(text, maxLength) {
  const str = extractString(text, '');
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}

// Difficulty config
const difficultyConfig = {
  beginner: {
    label: 'Beginner',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  intermediate: {
    label: 'Intermediate',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  advanced: {
    label: 'Advanced',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  },
};

// Filter tabs
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
];

export default function FlashcardsView({ flashcards, userId, onInteraction }) {
  const { id: conversationId } = useParams();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'grid'
  const [activeFilter, setActiveFilter] = useState('due');
  const [selectedGridCard, setSelectedGridCard] = useState(null);
  const [cardProgress, setCardProgress] = useState({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [showRatingButtons, setShowRatingButtons] = useState(false);

  // Load progress from Supabase
  useEffect(() => {
    async function loadProgress() {
      if (!userId || !conversationId) {
        setIsLoadingProgress(false);
        return;
      }

      try {
        const progress = await getFlashcardProgress(userId, conversationId);
        setCardProgress(progress);
      } catch (error) {
        console.error('Failed to load flashcard progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    }

    loadProgress();
  }, [userId, conversationId]);

  // Process flashcards with progress data
  const processedCards = useMemo(() => {
    if (!flashcards || !Array.isArray(flashcards)) return [];

    return flashcards.map((card, idx) => {
      const cardId = card.id || `card_${idx}`;
      const progress = cardProgress[cardId] || null;

      return {
        id: cardId,
        front: extractString(card.front || card.question || card.term, ''),
        back: extractString(card.back || card.answer || card.definition, ''),
        difficulty: card.difficulty || 'intermediate',
        progress,
        status: getCardStatus(progress),
        isDue: isDueForReview(progress?.nextReviewDate),
        dueDescription: progress ? getDueDescription(progress.nextReviewDate) : 'New card',
      };
    });
  }, [flashcards, cardProgress]);

  // Sort cards by priority (due first, then new)
  const sortedCards = useMemo(() => {
    return sortCardsByPriority(processedCards);
  }, [processedCards]);

  // Filter cards based on active filter
  const filteredCards = useMemo(() => {
    switch (activeFilter) {
      case 'due':
        return sortedCards.filter(card => card.isDue || card.status === 'new');
      case 'new':
        return sortedCards.filter(card => card.status === 'new');
      case 'learning':
        return sortedCards.filter(card => card.status === 'learning' || card.status === 'review');
      case 'mastered':
        return sortedCards.filter(card => card.status === 'mastered');
      default:
        return sortedCards;
    }
  }, [sortedCards, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const dueCount = processedCards.filter(c => c.isDue || c.status === 'new').length;
    const newCount = processedCards.filter(c => c.status === 'new').length;
    const learningCount = processedCards.filter(c => c.status === 'learning' || c.status === 'review').length;
    const masteredCount = processedCards.filter(c => c.status === 'mastered').length;
    const mastery = processedCards.length > 0 ? Math.round((masteredCount / processedCards.length) * 100) : 0;

    return {
      total: processedCards.length,
      due: dueCount,
      new: newCount,
      learning: learningCount,
      mastered: masteredCount,
      mastery,
    };
  }, [processedCards]);

  // Reset current index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowRatingButtons(false);
  }, [activeFilter]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'single') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (showRatingButtons && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        handleRating(parseInt(e.key));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, viewMode, showRatingButtons]);

  const currentCard = filteredCards[currentIndex] || filteredCards[0];

  const handleNext = useCallback(() => {
    if (filteredCards.length === 0) return;
    setDirection(1);
    setIsFlipped(false);
    setShowRatingButtons(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
    onInteraction?.({ type: 'flashcard_next', cardIndex: currentIndex });
  }, [filteredCards.length, currentIndex, onInteraction]);

  const handlePrev = useCallback(() => {
    if (filteredCards.length === 0) return;
    setDirection(-1);
    setIsFlipped(false);
    setShowRatingButtons(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
  }, [filteredCards.length]);

  const handleFlip = useCallback(() => {
    setIsFlipped(true);
    setShowRatingButtons(true);
    onInteraction?.({ type: 'flashcard_flip', cardIndex: currentIndex });
  }, [currentIndex, onInteraction]);

  // Handle SM-2 rating
  const handleRating = useCallback(async (quality) => {
    if (!currentCard) return;

    const progress = currentCard.progress || {
      easeFactor: SM2_DEFAULTS.easeFactor,
      interval: SM2_DEFAULTS.interval,
      repetitions: SM2_DEFAULTS.repetitions,
      timesSeen: 0,
      timesCorrect: 0,
    };

    // Calculate new SM-2 values
    const newValues = calculateSM2(
      quality,
      progress.easeFactor,
      progress.interval,
      progress.repetitions
    );

    const newProgress = {
      ...newValues,
      timesSeen: (progress.timesSeen || 0) + 1,
      timesCorrect: quality >= 3 ? (progress.timesCorrect || 0) + 1 : progress.timesCorrect || 0,
      lastRating: quality,
    };

    // Update local state immediately for responsiveness
    setCardProgress(prev => ({
      ...prev,
      [currentCard.id]: {
        ...newProgress,
        nextReviewDate: newValues.nextReviewDate,
      },
    }));

    // Save to database
    if (userId && conversationId) {
      try {
        await updateFlashcardProgress(userId, conversationId, currentCard.id, newProgress);
        await updateStudyStreak(userId, 1);
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }

    onInteraction?.({
      type: 'flashcard_rated',
      cardId: currentCard.id,
      quality,
      newInterval: newValues.interval,
    });

    // Move to next card
    handleNext();
  }, [currentCard, userId, conversationId, onInteraction, handleNext]);

  // Get interval previews for current card
  const intervalPreviews = useMemo(() => {
    if (!currentCard) return {};
    return getIntervalPreviews(currentCard.progress);
  }, [currentCard]);

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  // Difficulty badge component
  const DifficultyBadge = ({ difficulty }) => {
    const config = difficultyConfig[difficulty] || difficultyConfig.intermediate;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Status badge component
  const StatusBadge = ({ status, dueDescription }) => {
    const statusConfig = {
      new: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'New' },
      learning: { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Learning' },
      review: { color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', label: 'Review' },
      mastered: { color: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Mastered' },
    };
    const config = statusConfig[status] || statusConfig.new;

    return (
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
        {dueDescription && status !== 'new' && (
          <span className="text-xs text-muted-foreground">{dueDescription}</span>
        )}
      </div>
    );
  };

  // Grid card component
  const GridCard = ({ card }) => {
    const [isGridFlipped, setIsGridFlipped] = useState(false);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
          selectedGridCard === card.id ? 'ring-2 ring-primary' : 'border-border'
        }`}
        onClick={() => setIsGridFlipped(!isGridFlipped)}
      >
        {/* Header with status and difficulty */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <StatusBadge status={card.status} />
          <DifficultyBadge difficulty={card.difficulty} />
        </div>

        {/* Content */}
        {!isGridFlipped ? (
          <>
            <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">
              {truncateText(card.front, 60)}
            </p>
            <p className="text-xs text-primary italic">Tap to reveal</p>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground mb-2 line-clamp-3">
              {truncateText(card.back, 80)}
            </p>
            <div className="flex gap-1 mt-2 pt-2 border-t border-border">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRatingForCard(card, q);
                  }}
                  className={`flex-1 text-xs py-1 rounded ${QUALITY_MAPPINGS.colors[q]}`}
                  title={`${QUALITY_MAPPINGS.shortLabels[q]} - ${intervalPreviews[q]?.description || ''}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Due indicator */}
        {card.isDue && card.status !== 'new' && (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {card.dueDescription}
          </div>
        )}
      </motion.div>
    );
  };

  const handleRatingForCard = async (card, quality) => {
    const progress = card.progress || {
      easeFactor: SM2_DEFAULTS.easeFactor,
      interval: SM2_DEFAULTS.interval,
      repetitions: SM2_DEFAULTS.repetitions,
      timesSeen: 0,
      timesCorrect: 0,
    };

    const newValues = calculateSM2(
      quality,
      progress.easeFactor,
      progress.interval,
      progress.repetitions
    );

    const newProgress = {
      ...newValues,
      timesSeen: (progress.timesSeen || 0) + 1,
      timesCorrect: quality >= 3 ? (progress.timesCorrect || 0) + 1 : progress.timesCorrect || 0,
      lastRating: quality,
    };

    setCardProgress(prev => ({
      ...prev,
      [card.id]: {
        ...newProgress,
        nextReviewDate: newValues.nextReviewDate,
      },
    }));

    if (userId && conversationId) {
      try {
        await updateFlashcardProgress(userId, conversationId, card.id, newProgress);
        await updateStudyStreak(userId, 1);
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }
  };

  if (isLoadingProgress) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!processedCards || processedCards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p>No flashcards available</p>
      </div>
    );
  }

  const progress = filteredCards.length > 0 ? ((currentIndex + 1) / filteredCards.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Due Today Banner */}
      {stats.due > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {stats.due} card{stats.due !== 1 ? 's' : ''} due for review
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Consistent review improves long-term retention.
            </p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{stats.total}</span>
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            Due: <span className="font-semibold">{stats.due}</span>
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            New: <span className="font-semibold">{stats.new}</span>
          </span>
          <span className="text-orange-600 dark:text-orange-400">
            Learning: <span className="font-semibold">{stats.learning}</span>
          </span>
          <span className="text-green-600 dark:text-green-400">
            Mastered: <span className="font-semibold">{stats.mastered}</span>
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setViewMode('single')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'single'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Single card view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">Mastery Progress</span>
          <span className="text-xs text-muted-foreground">{stats.mastery}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.mastery}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const count = tab.id === 'all' ? stats.total :
                        tab.id === 'due' ? stats.due :
                        tab.id === 'new' ? stats.new :
                        tab.id === 'learning' ? stats.learning : stats.mastered;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeFilter === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state for filtered view */}
      {filteredCards.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No cards in this category</p>
          <button
            onClick={() => setActiveFilter('all')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            View all cards
          </button>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCards.map((card) => (
            <GridCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Single Card View */}
      {viewMode === 'single' && filteredCards.length > 0 && (
        <>
          {/* Progress indicator */}
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
              {currentIndex + 1} / {filteredCards.length}
            </span>
          </div>

          {/* Card */}
          <div className="relative h-80 perspective-1000">
            <AnimatePresence mode="wait" custom={direction}>
              {currentCard && (
                <motion.div
                  key={currentCard.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <div
                    onClick={() => !isFlipped && handleFlip()}
                    className="w-full h-full cursor-pointer preserve-3d"
                    style={{ perspective: '1000px' }}
                  >
                    <motion.div
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                      className="relative w-full h-full"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 border border-border rounded-2xl p-6 flex flex-col backface-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        {/* Header with status and difficulty */}
                        <div className="flex items-center justify-between mb-4 gap-2">
                          <StatusBadge status={currentCard.status} dueDescription={currentCard.dueDescription} />
                          <DifficultyBadge difficulty={currentCard.difficulty} />
                        </div>

                        {/* Question */}
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-lg font-medium text-foreground leading-relaxed text-center">
                            {currentCard.front}
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground text-center mt-4">
                          Press Space or click to reveal answer
                        </p>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-500/10 border border-green-500/30 rounded-2xl p-6 flex flex-col backface-hidden rotate-y-180"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <DifficultyBadge difficulty={currentCard.difficulty} />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Answer</span>
                        </div>

                        {/* Answer */}
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-lg text-foreground leading-relaxed text-center">
                            {currentCard.back}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rating Buttons - Show after flip */}
          {showRatingButtons && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-center text-sm text-muted-foreground">
                How well did you know this?
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {[1, 2, 3, 4, 5].map((quality) => (
                  <button
                    key={quality}
                    onClick={() => handleRating(quality)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all min-w-[70px] ${QUALITY_MAPPINGS.colors[quality]} border border-transparent hover:border-current`}
                  >
                    <span className="font-semibold">{quality}</span>
                    <span className="text-xs opacity-80">{QUALITY_MAPPINGS.shortLabels[quality]}</span>
                    <span className="text-[10px] opacity-60">{intervalPreviews[quality]?.description}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Press 1-5 on keyboard to rate
              </p>
            </motion.div>
          )}

          {/* Navigation (shown when not rating) */}
          {!showRatingButtons && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePrev}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleFlip}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Reveal Answer
              </button>

              <button
                onClick={handleNext}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Keyboard hints */}
          <p className="text-center text-xs text-muted-foreground">
            Space: flip • ← →: navigate • 1-5: rate (after flip)
          </p>
        </>
      )}
    </div>
  );
}
