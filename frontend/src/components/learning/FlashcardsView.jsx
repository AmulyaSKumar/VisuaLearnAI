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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Create Flashcard</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Question (Front)
            </label>
            <textarea
              ref={questionRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter the question..."
              className="w-full h-24 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Answer (Back)
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter the answer..."
              className="w-full h-24 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., JavaScript, React..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!question.trim() || !answer.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Card
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-48 perspective-1000 cursor-pointer group"
      onClick={handleFlip}
    >
      <div
        className={`relative w-full h-full transition-transform duration-500 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-card border border-border rounded-xl p-4 flex flex-col backface-hidden group-hover:border-primary/50 group-hover:shadow-lg transition-all"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* User card indicator */}
          {isUserCard && (
            <div className="absolute top-2 right-2">
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded">
                My Card
              </span>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-foreground text-center leading-relaxed line-clamp-4">
              {card.front}
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-2">
            Tap to reveal
          </p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col backface-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-foreground text-center leading-relaxed line-clamp-4">
              {card.back}
            </p>
          </div>

          {/* Rating buttons */}
          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-emerald-500/20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRate(card.id, 2);
                setIsFlipped(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Hard
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRate(card.id, 4);
                setIsFlipped(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Easy
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [userCards, setUserCards] = useState([]);
  const [cardProgress, setCardProgress] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flashcards..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Create Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Flashcard
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {FILTER_OPTIONS.map((filter) => {
          const count = filter.id === 'all' ? stats.total :
                        filter.id === 'my' ? stats.userCount : stats.systemCount;
          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFilter === filter.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeFilter === filter.id ? 'bg-primary/10 text-primary' : 'bg-muted'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {allCards.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'No flashcards match your search' : 'No flashcards yet'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-primary hover:underline text-sm"
          >
            Create your first flashcard
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
        <p className="text-center text-xs text-muted-foreground">
          Click to flip • Space: flip • Arrow keys: navigate
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
  );
}
