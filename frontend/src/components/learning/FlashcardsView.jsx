import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateSM2,
  isDueForReview,
  sortCardsByPriority,
  getCardStatus,
  SM2_DEFAULTS,
} from '../../utils/spacedRepetition';
import {
  getFlashcardProgress,
  updateFlashcardProgress,
  updateStudyStreak,
  supabase,
} from '../../lib/supabase';

// ============================================
// CONSTANTS
// ============================================

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'my', label: 'My Cards' },
  { id: 'system', label: 'System' },
];

const LOCAL_STORAGE_KEY = 'visualearn_user_flashcards';

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// ============================================
// CREATE FLASHCARD MODAL
// ============================================

function CreateFlashcardModal({ isOpen, onClose, onSave }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [topic, setTopic] = useState('');
  const questionRef = useRef(null);

  useEffect(() => {
    if (isOpen && questionRef.current) {
      questionRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setAnswer('');
      setTopic('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!question.trim() || !answer.trim()) return;
    onSave({ question: question.trim(), answer: answer.trim(), topic: topic.trim() });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative bg-card border border-border rounded-md shadow-lg w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">New Flashcard</h3>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Front
            </label>
            <textarea
              ref={questionRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question or term"
              className="w-full h-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Back
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer or definition"
              className="w-full h-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!question.trim() || !answer.trim()}
            className="px-4 py-1.5 text-sm font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// FLASHCARD CARD COMPONENT
// ============================================

function FlashcardCard({ card, onRate, isUserCard }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-44 perspective-1000 cursor-pointer"
      onClick={handleFlip}
    >
      <div
        className={`relative w-full h-full transition-transform duration-300 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-card border border-border rounded-md p-4 flex flex-col backface-hidden hover:border-muted-foreground/30 transition-colors"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {isUserCard && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Custom</p>
          )}

          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-foreground text-center leading-relaxed line-clamp-4">
              {card.front}
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Click to flip
          </p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-muted/30 border border-border rounded-md p-4 flex flex-col backface-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-foreground text-center leading-relaxed line-clamp-4">
              {card.back}
            </p>
          </div>

          {/* Rating buttons */}
          <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRate(card.id, 2);
                setIsFlipped(false);
              }}
              className="px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
            >
              Again
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRate(card.id, 4);
                setIsFlipped(false);
              }}
              className="px-4 py-1.5 text-xs font-medium text-foreground bg-foreground/10 border border-transparent rounded-md hover:bg-foreground/20 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN FLASHCARDS VIEW
// ============================================

export default function FlashcardsView({ flashcards, userId, onInteraction, updateConceptMastery }) {
  const { id: conversationId } = useParams();

  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [userCards, setUserCards] = useState([]);
  const [cardProgress, setCardProgress] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Load user cards and progress
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      // Load user flashcards
      if (userId && conversationId) {
        try {
          // Try to load from Supabase
          const { data: dbCards } = await supabase
            .from('user_flashcards')
            .select('*')
            .eq('user_id', userId)
            .eq('conversation_id', conversationId);

          if (dbCards) {
            setUserCards(dbCards.map(c => ({
              id: c.id,
              front: c.question,
              back: c.answer,
              topic: c.topic,
              isUserCard: true,
              createdAt: c.created_at,
            })));
          }

          // Load progress
          const progress = await getFlashcardProgress(userId, conversationId);
          setCardProgress(progress);
        } catch (error) {
          console.error('Failed to load from Supabase:', error);
          // Fallback to localStorage
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }

      setIsLoading(false);
    }

    function loadFromLocalStorage() {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const sessionCards = parsed[conversationId] || [];
          setUserCards(sessionCards.map(c => ({ ...c, isUserCard: true })));
        } catch (e) {
          console.error('Failed to parse localStorage:', e);
        }
      }
    }

    loadData();
  }, [userId, conversationId]);

  // Process system flashcards
  const systemCards = useMemo(() => {
    if (!flashcards || !Array.isArray(flashcards)) return [];

    return flashcards.map((card, idx) => ({
      id: card.id || `system_${idx}`,
      front: extractString(card.front || card.question || card.term, ''),
      back: extractString(card.back || card.answer || card.definition, ''),
      isUserCard: false,
      progress: cardProgress[card.id || `system_${idx}`] || null,
    }));
  }, [flashcards, cardProgress]);

  // Combine and filter cards
  const allCards = useMemo(() => {
    const combined = [...userCards, ...systemCards];

    // Apply filter
    let filtered = combined;
    if (activeFilter === 'my') {
      filtered = combined.filter(c => c.isUserCard);
    } else if (activeFilter === 'system') {
      filtered = combined.filter(c => !c.isUserCard);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.front.toLowerCase().includes(query) ||
        c.back.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [userCards, systemCards, activeFilter, searchQuery]);

  // Create flashcard handler
  const handleCreateCard = useCallback(async ({ question, answer, topic }) => {
    const newCard = {
      id: `user_${Date.now()}`,
      front: question,
      back: answer,
      topic,
      isUserCard: true,
      createdAt: new Date().toISOString(),
    };

    // Save to Supabase if logged in
    if (userId && conversationId) {
      try {
        await supabase.from('user_flashcards').insert({
          user_id: userId,
          conversation_id: conversationId,
          question,
          answer,
          topic,
        });
      } catch (error) {
        console.error('Failed to save to Supabase:', error);
      }
    }

    // Also save to localStorage as backup
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[conversationId] = [...(parsed[conversationId] || []), newCard];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));

    setUserCards(prev => [newCard, ...prev]);

    onInteraction?.({ type: 'flashcard_created', cardId: newCard.id });
  }, [userId, conversationId, onInteraction]);

  // Rate card handler
  const handleRate = useCallback(async (cardId, quality) => {
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;

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
      lastReviewed: new Date().toISOString(),
      difficulty: quality <= 2 ? 'hard' : 'easy',
    };

    setCardProgress(prev => ({
      ...prev,
      [cardId]: newProgress,
    }));

    // Update concept mastery
    if (updateConceptMastery) {
      updateConceptMastery(cardId, quality >= 3, 'flashcard');
    }

    // Save to database
    if (userId && conversationId) {
      try {
        await updateFlashcardProgress(userId, conversationId, cardId, newProgress);
        await updateStudyStreak(userId, 1);
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }

    onInteraction?.({ type: 'flashcard_rated', cardId, quality });
  }, [allCards, userId, conversationId, updateConceptMastery, onInteraction]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') {
        setFocusedIndex(prev => Math.min(prev + 1, allCards.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === ' ' && focusedIndex >= 0) {
        e.preventDefault();
        // Flip focused card - handled by card component
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allCards.length, focusedIndex]);

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const userCount = allCards.filter(c => c.isUserCard).length;
    const systemCount = total - userCount;
    return { total, userCount, systemCount };
  }, [allCards]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const shellClassName = isFullscreen
    ? 'fixed inset-0 z-[9999] overflow-y-auto bg-background p-4 sm:p-6'
    : 'space-y-6';
  const innerClassName = isFullscreen
    ? 'mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col gap-6 bg-background sm:min-h-[calc(100dvh-3rem)]'
    : 'space-y-6';
  const fullscreenButton = (
    <button
      type="button"
      onClick={() => setIsFullscreen(value => !value)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label={isFullscreen ? 'Exit full screen flashcards' : 'Open flashcards full screen'}
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

  return (
    <div className={shellClassName}>
      <div className={innerClassName}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
        >
          Add Card
        </button>

        {fullscreenButton}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        {FILTER_OPTIONS.map((filter) => {
          const count = filter.id === 'all' ? stats.total :
                        filter.id === 'my' ? stats.userCount : stats.systemCount;
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`relative pb-2 text-sm font-medium transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label} ({count})
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {allCards.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {searchQuery ? 'No cards match your search' : 'No flashcards available'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-sm text-foreground hover:underline"
          >
            Create a card
          </button>
        </div>
      )}

      {/* Flashcard Grid */}
      {allCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {allCards.map((card, index) => (
              <FlashcardCard
                key={card.id}
                card={card}
                onRate={handleRate}
                isUserCard={card.isUserCard}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Keyboard Hints */}
      {allCards.length > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-4">
          Click card to reveal answer
        </p>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateFlashcardModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSave={handleCreateCard}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
