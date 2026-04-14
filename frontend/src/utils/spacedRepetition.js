/**
 * SM-2 Spaced Repetition Algorithm Implementation
 *
 * Based on the SuperMemo SM-2 algorithm by Piotr Wozniak
 * https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Quality ratings:
 * 1 - Complete blackout, no recall
 * 2 - Incorrect response, but upon seeing correct answer, it felt familiar
 * 3 - Incorrect response, but upon seeing correct answer, it seemed easy to remember
 * 4 - Correct response with difficulty
 * 5 - Perfect response with no hesitation
 */

// Default values for new cards
export const SM2_DEFAULTS = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
};

// Minimum ease factor to prevent cards from becoming too hard
const MIN_EASE_FACTOR = 1.3;

/**
 * Calculate new SM-2 values after a review
 * @param {number} quality - Quality of recall (1-5)
 * @param {number} easeFactor - Current ease factor
 * @param {number} interval - Current interval in days
 * @param {number} repetitions - Number of successful repetitions
 * @returns {Object} New SM-2 values
 */
export function calculateSM2(quality, easeFactor = 2.5, interval = 0, repetitions = 0) {
  // Ensure quality is in valid range
  const q = Math.max(1, Math.min(5, Math.round(quality)));

  let newEaseFactor = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  // Update ease factor using SM-2 formula
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  // Enforce minimum ease factor
  if (newEaseFactor < MIN_EASE_FACTOR) {
    newEaseFactor = MIN_EASE_FACTOR;
  }

  // If quality < 3, reset repetitions and interval (card was forgotten)
  if (q < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review again tomorrow
  } else {
    // Card was recalled successfully
    newRepetitions = repetitions + 1;

    // Calculate new interval based on repetition count
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      // I(n) = I(n-1) * EF
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100, // Round to 2 decimal places
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: nextReviewDate.toISOString(),
  };
}

/**
 * Check if a card is due for review
 * @param {string|Date} nextReviewDate - The next scheduled review date
 * @returns {boolean} True if card is due today or overdue
 */
export function isDueForReview(nextReviewDate) {
  if (!nextReviewDate) return true; // New cards are always due

  const reviewDate = new Date(nextReviewDate);
  const today = new Date();

  // Set both to start of day for comparison
  reviewDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return reviewDate <= today;
}

/**
 * Get the number of days until a card is due
 * @param {string|Date} nextReviewDate - The next scheduled review date
 * @returns {number} Days until due (negative if overdue, 0 if today)
 */
export function getDaysUntilDue(nextReviewDate) {
  if (!nextReviewDate) return 0;

  const reviewDate = new Date(nextReviewDate);
  const today = new Date();

  // Set both to start of day
  reviewDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = reviewDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Sort cards by review priority
 * - Due/overdue cards first (sorted by how overdue)
 * - New cards second
 * - Future cards last
 * @param {Array} cards - Array of cards with progress data
 * @returns {Array} Sorted cards
 */
export function sortCardsByPriority(cards) {
  return [...cards].sort((a, b) => {
    const aDue = getDaysUntilDue(a.progress?.nextReviewDate);
    const bDue = getDaysUntilDue(b.progress?.nextReviewDate);
    const aIsNew = !a.progress || a.progress.repetitions === 0;
    const bIsNew = !b.progress || b.progress.repetitions === 0;

    // Overdue cards first (most overdue first)
    if (aDue <= 0 && bDue <= 0) {
      return aDue - bDue; // More overdue first
    }

    // Due today before future
    if (aDue <= 0 && bDue > 0) return -1;
    if (bDue <= 0 && aDue > 0) return 1;

    // New cards before future scheduled cards
    if (aIsNew && !bIsNew) return -1;
    if (bIsNew && !aIsNew) return 1;

    // Sort future cards by due date
    return aDue - bDue;
  });
}

/**
 * Get card status based on progress
 * @param {Object} progress - Card progress data
 * @returns {string} 'new' | 'learning' | 'review' | 'mastered'
 */
export function getCardStatus(progress) {
  if (!progress || progress.repetitions === 0) {
    return 'new';
  }

  if (progress.repetitions < 3) {
    return 'learning';
  }

  if (progress.interval >= 21) { // 3+ weeks interval
    return 'mastered';
  }

  return 'review';
}

/**
 * Get human-readable description of when card is due
 * @param {string|Date} nextReviewDate - The next scheduled review date
 * @returns {string} Human-readable due description
 */
export function getDueDescription(nextReviewDate) {
  const days = getDaysUntilDue(nextReviewDate);

  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? '1 day overdue' : `${overdue} days overdue`;
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days === 1) {
    return 'Due tomorrow';
  }

  if (days < 7) {
    return `Due in ${days} days`;
  }

  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'Due in 1 week' : `Due in ${weeks} weeks`;
  }

  const months = Math.round(days / 30);
  return months === 1 ? 'Due in 1 month' : `Due in ${months} months`;
}

/**
 * Calculate session statistics
 * @param {Array} cards - Array of cards with progress data
 * @returns {Object} Session statistics
 */
export function calculateSessionStats(cards) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let dueToday = 0;
  let newCards = 0;
  let learningCards = 0;
  let masteredCards = 0;
  let totalReviews = 0;
  let totalCorrect = 0;

  for (const card of cards) {
    const progress = card.progress;

    if (!progress || progress.repetitions === 0) {
      newCards++;
      dueToday++; // New cards are always due
    } else {
      totalReviews += progress.timesSeen || 0;
      totalCorrect += progress.timesCorrect || 0;

      if (isDueForReview(progress.nextReviewDate)) {
        dueToday++;
      }

      const status = getCardStatus(progress);
      if (status === 'learning') learningCards++;
      if (status === 'mastered') masteredCards++;
    }
  }

  const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
  const mastery = cards.length > 0 ? Math.round((masteredCards / cards.length) * 100) : 0;

  return {
    total: cards.length,
    dueToday,
    newCards,
    learningCards,
    masteredCards,
    reviewCards: cards.length - newCards - masteredCards - learningCards,
    accuracy,
    mastery,
  };
}

/**
 * Map UI actions to quality ratings
 * For simpler UX, we can map 3 buttons to quality ratings
 */
export const QUALITY_MAPPINGS = {
  // Simple 3-button mapping
  again: 1,      // Didn't know it
  hard: 3,       // Knew it but struggled
  good: 4,       // Knew it
  easy: 5,       // Too easy

  // Full 5-button mapping (labels)
  labels: {
    1: 'Blackout',
    2: 'Familiar',
    3: 'Hard',
    4: 'Good',
    5: 'Easy',
  },

  // Short labels
  shortLabels: {
    1: 'Again',
    2: 'Hard',
    3: 'Okay',
    4: 'Good',
    5: 'Easy',
  },

  // Colors for buttons
  colors: {
    1: 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20',
    2: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20',
    3: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20',
    4: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20',
    5: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
  },
};

/**
 * Get preview of next intervals for each rating
 * Helps user understand what their choice means
 * @param {Object} currentProgress - Current card progress
 * @returns {Object} Preview intervals for each rating
 */
export function getIntervalPreviews(currentProgress) {
  const { easeFactor = 2.5, interval = 0, repetitions = 0 } = currentProgress || {};

  const previews = {};

  for (let q = 1; q <= 5; q++) {
    const result = calculateSM2(q, easeFactor, interval, repetitions);
    previews[q] = {
      interval: result.interval,
      description: result.interval === 1 ? '1 day' :
                   result.interval < 7 ? `${result.interval} days` :
                   result.interval < 30 ? `${Math.round(result.interval / 7)} week${Math.round(result.interval / 7) > 1 ? 's' : ''}` :
                   `${Math.round(result.interval / 30)} month${Math.round(result.interval / 30) > 1 ? 's' : ''}`,
    };
  }

  return previews;
}

export default {
  calculateSM2,
  isDueForReview,
  getDaysUntilDue,
  sortCardsByPriority,
  getCardStatus,
  getDueDescription,
  calculateSessionStats,
  getIntervalPreviews,
  QUALITY_MAPPINGS,
  SM2_DEFAULTS,
};
