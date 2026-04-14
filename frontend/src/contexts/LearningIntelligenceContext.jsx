import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

// ============================================
// LEARNING INTELLIGENCE CONTEXT
// ============================================
// Unified brain that tracks user learning progress
// and adapts content across all tabs

const LearningIntelligenceContext = createContext(null);

// Storage key for persistence
const STORAGE_KEY = 'visualearn_intelligence';

// Default user profile
const DEFAULT_PROFILE = {
  // Current topic being studied
  currentTopic: null,

  // Depth preference: 'simple' | 'balanced' | 'technical'
  depthLevel: 'balanced',

  // Concept mastery tracking
  concepts: {},
  // Example: { 'neural_networks': { confidence: 0.3, attempts: 5, correct: 2, lastSeen: Date } }

  // Weak and strong areas (derived from concepts)
  weakAreas: [],
  strongAreas: [],

  // Quiz performance history
  quizHistory: [],

  // Flashcard progress (SM-2 data)
  flashcardProgress: {},

  // Overall stats
  stats: {
    totalQuizzes: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    studyStreak: 0,
    lastStudyDate: null,
  }
};

// Confidence thresholds
const WEAK_THRESHOLD = 0.4;
const STRONG_THRESHOLD = 0.75;

export function LearningIntelligenceProvider({ children }) {
  // Load profile from localStorage
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load learning profile:', e);
    }
    return DEFAULT_PROFILE;
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save learning profile:', e);
    }
  }, [profile]);

  // ============================================
  // DEPTH LEVEL MANAGEMENT
  // ============================================

  const setDepthLevel = useCallback((level) => {
    setProfile(prev => ({ ...prev, depthLevel: level }));
  }, []);

  // ============================================
  // CONCEPT TRACKING
  // ============================================

  const updateConceptMastery = useCallback((conceptId, isCorrect, questionType = 'quiz') => {
    setProfile(prev => {
      const existing = prev.concepts[conceptId] || {
        confidence: 0.5,
        attempts: 0,
        correct: 0,
        lastSeen: null,
        questionTypes: {}
      };

      // Update stats
      const newAttempts = existing.attempts + 1;
      const newCorrect = existing.correct + (isCorrect ? 1 : 0);

      // Calculate new confidence with recency weighting
      const rawConfidence = newCorrect / newAttempts;
      const recencyBoost = isCorrect ? 0.05 : -0.05;
      const newConfidence = Math.max(0, Math.min(1,
        existing.confidence * 0.7 + rawConfidence * 0.3 + recencyBoost
      ));

      // Track by question type
      const typeStats = existing.questionTypes[questionType] || { attempts: 0, correct: 0 };
      typeStats.attempts += 1;
      typeStats.correct += isCorrect ? 1 : 0;

      const updatedConcepts = {
        ...prev.concepts,
        [conceptId]: {
          ...existing,
          confidence: newConfidence,
          attempts: newAttempts,
          correct: newCorrect,
          lastSeen: new Date().toISOString(),
          questionTypes: {
            ...existing.questionTypes,
            [questionType]: typeStats
          }
        }
      };

      // Recalculate weak/strong areas
      const weakAreas = [];
      const strongAreas = [];

      Object.entries(updatedConcepts).forEach(([id, data]) => {
        if (data.confidence < WEAK_THRESHOLD) {
          weakAreas.push({ id, confidence: data.confidence, attempts: data.attempts });
        } else if (data.confidence >= STRONG_THRESHOLD) {
          strongAreas.push({ id, confidence: data.confidence, attempts: data.attempts });
        }
      });

      // Sort by confidence (weakest first for weak, strongest first for strong)
      weakAreas.sort((a, b) => a.confidence - b.confidence);
      strongAreas.sort((a, b) => b.confidence - a.confidence);

      return {
        ...prev,
        concepts: updatedConcepts,
        weakAreas,
        strongAreas,
        stats: {
          ...prev.stats,
          totalAttempts: prev.stats.totalAttempts + 1,
          totalCorrect: prev.stats.totalCorrect + (isCorrect ? 1 : 0)
        }
      };
    });
  }, []);

  // ============================================
  // QUIZ TRACKING
  // ============================================

  const recordQuizResult = useCallback((quizData) => {
    const { topic, questions, answers, score } = quizData;

    setProfile(prev => {
      // Update concept mastery for each question
      questions.forEach((q, idx) => {
        if (q.concept_id && answers[idx]) {
          updateConceptMastery(q.concept_id, answers[idx].isCorrect, q.type || 'mcq');
        }
      });

      // Add to quiz history
      const quizRecord = {
        id: Date.now(),
        topic,
        score,
        totalQuestions: questions.length,
        timestamp: new Date().toISOString(),
        weakConcepts: questions
          .filter((q, idx) => answers[idx] && !answers[idx].isCorrect)
          .map(q => q.concept_id || q.question.substring(0, 50))
      };

      // Update streak
      const today = new Date().toISOString().split('T')[0];
      const lastDate = prev.stats.lastStudyDate;
      let newStreak = prev.stats.studyStreak;

      if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastDate === yesterdayStr) {
          newStreak += 1;
        } else if (lastDate !== today) {
          newStreak = 1;
        }
      }

      return {
        ...prev,
        quizHistory: [quizRecord, ...prev.quizHistory.slice(0, 49)],
        stats: {
          ...prev.stats,
          totalQuizzes: prev.stats.totalQuizzes + 1,
          studyStreak: newStreak,
          lastStudyDate: today
        }
      };
    });
  }, [updateConceptMastery]);

  // ============================================
  // CONTENT RECOMMENDATIONS
  // ============================================

  const getRecommendations = useCallback(() => {
    const recommendations = {
      priorityConcepts: [], // Concepts to focus on
      suggestedQuestions: [], // Question types to practice
      reviewReminders: [], // Concepts due for review
    };

    // Find concepts that need attention
    Object.entries(profile.concepts).forEach(([conceptId, data]) => {
      // Low confidence = priority
      if (data.confidence < WEAK_THRESHOLD) {
        recommendations.priorityConcepts.push({
          id: conceptId,
          confidence: data.confidence,
          reason: 'needs_practice'
        });
      }

      // Check for spaced repetition review
      if (data.lastSeen) {
        const daysSince = Math.floor(
          (Date.now() - new Date(data.lastSeen).getTime()) / (1000 * 60 * 60 * 24)
        );
        const reviewInterval = Math.max(1, Math.floor(data.confidence * 14)); // 1-14 days based on confidence

        if (daysSince >= reviewInterval) {
          recommendations.reviewReminders.push({
            id: conceptId,
            daysSince,
            confidence: data.confidence
          });
        }
      }

      // Check which question types need practice
      if (data.questionTypes) {
        Object.entries(data.questionTypes).forEach(([type, stats]) => {
          const typeAccuracy = stats.correct / stats.attempts;
          if (typeAccuracy < 0.5 && stats.attempts >= 2) {
            recommendations.suggestedQuestions.push({
              conceptId,
              questionType: type,
              accuracy: typeAccuracy
            });
          }
        });
      }
    });

    return recommendations;
  }, [profile.concepts]);

  // ============================================
  // CONTENT ORDERING
  // ============================================

  const orderContentByMastery = useCallback((items, getConceptId = (item) => item.id) => {
    // Order content putting weak concepts first
    return [...items].sort((a, b) => {
      const aId = getConceptId(a);
      const bId = getConceptId(b);
      const aConfidence = profile.concepts[aId]?.confidence ?? 0.5;
      const bConfidence = profile.concepts[bId]?.confidence ?? 0.5;
      return aConfidence - bConfidence; // Lower confidence first
    });
  }, [profile.concepts]);

  // ============================================
  // GET CONCEPT STATUS
  // ============================================

  const getConceptStatus = useCallback((conceptId) => {
    const data = profile.concepts[conceptId];
    if (!data) {
      return { status: 'new', confidence: 0, attempts: 0 };
    }

    let status = 'learning';
    if (data.confidence >= STRONG_THRESHOLD) status = 'mastered';
    else if (data.confidence < WEAK_THRESHOLD) status = 'weak';

    return {
      status,
      confidence: data.confidence,
      attempts: data.attempts,
      correct: data.correct,
      lastSeen: data.lastSeen
    };
  }, [profile.concepts]);

  // ============================================
  // RESET / CLEAR
  // ============================================

  const resetProgress = useCallback((conceptId = null) => {
    if (conceptId) {
      setProfile(prev => {
        const { [conceptId]: removed, ...remaining } = prev.concepts;
        return { ...prev, concepts: remaining };
      });
    } else {
      setProfile(DEFAULT_PROFILE);
    }
  }, []);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value = useMemo(() => ({
    // Profile data
    profile,
    depthLevel: profile.depthLevel,
    weakAreas: profile.weakAreas,
    strongAreas: profile.strongAreas,
    stats: profile.stats,

    // Actions
    setDepthLevel,
    updateConceptMastery,
    recordQuizResult,
    getRecommendations,
    orderContentByMastery,
    getConceptStatus,
    resetProgress,

    // Helpers
    isConceptWeak: (id) => profile.concepts[id]?.confidence < WEAK_THRESHOLD,
    isConceptStrong: (id) => profile.concepts[id]?.confidence >= STRONG_THRESHOLD,
    getConceptConfidence: (id) => profile.concepts[id]?.confidence ?? 0.5,
  }), [
    profile,
    setDepthLevel,
    updateConceptMastery,
    recordQuizResult,
    getRecommendations,
    orderContentByMastery,
    getConceptStatus,
    resetProgress
  ]);

  return (
    <LearningIntelligenceContext.Provider value={value}>
      {children}
    </LearningIntelligenceContext.Provider>
  );
}

export function useLearningIntelligence() {
  const context = useContext(LearningIntelligenceContext);
  if (!context) {
    throw new Error('useLearningIntelligence must be used within LearningIntelligenceProvider');
  }
  return context;
}

export default LearningIntelligenceContext;
