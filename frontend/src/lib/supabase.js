import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_CONVERSATION_TITLE,
  MAX_CONVERSATION_TITLE_LENGTH,
  normalizeConversationTitle,
  sortConversations,
} from '../utils/conversationActions';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const missingConfigMessage =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let sessionRequest = null;

if (!hasSupabaseConfig) {
  console.warn(missingConfigMessage);
}

/**
 * Supabase client with anon key
 * Used for frontend operations (respects RLS policies)
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: hasSupabaseConfig,
      persistSession: hasSupabaseConfig,
      detectSessionInUrl: hasSupabaseConfig,
    },
  },
);

function getFriendlyAuthError(error, fallbackMessage) {
  if (!hasSupabaseConfig) {
    return missingConfigMessage;
  }

  const rawMessage = error?.message || fallbackMessage;

  if (
    rawMessage === 'Failed to fetch' ||
    rawMessage?.includes('Failed to fetch') ||
    rawMessage?.includes('NetworkError')
  ) {
    return 'Unable to reach Supabase. Check your internet connection, Supabase URL/key, and allowed auth origins.';
  }

  return rawMessage;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email, password) {
  if (!hasSupabaseConfig) {
    return { success: false, error: missingConfigMessage };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: getFriendlyAuthError(error, 'Unable to sign up') };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  if (!hasSupabaseConfig) {
    return { success: false, error: missingConfigMessage };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: getFriendlyAuthError(error, 'Unable to sign in') };
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  if (!hasSupabaseConfig) {
    return { success: false, error: missingConfigMessage };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat/new`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { success: false, error: getFriendlyAuthError(error, 'Unable to sign in with Google') };
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (!hasSupabaseConfig) {
    return { success: true };
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: getFriendlyAuthError(error, 'Unable to sign out') };
  }
}

/**
 * Get current user session
 */
export async function getSession() {
  if (!hasSupabaseConfig) {
    return { session: null, user: null, error: missingConfigMessage };
  }

  if (sessionRequest) {
    return sessionRequest;
  }

  try {
    sessionRequest = supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error && !data.session) {
          throw error;
        }

        return {
          session: data.session,
          user: data.session?.user || null,
          error: error ? getFriendlyAuthError(error, 'Unable to restore session') : null,
        };
      })
      .catch((error) => {
        console.error('Get session error:', error);
        return {
          session: null,
          user: null,
          error: getFriendlyAuthError(error, 'Unable to restore session'),
        };
      })
      .finally(() => {
        sessionRequest = null;
      });

    return await sessionRequest;
  } catch (error) {
    console.error('Get session error:', error);
    return {
      session: null,
      user: null,
      error: getFriendlyAuthError(error, 'Unable to restore session'),
    };
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback) {
  if (!hasSupabaseConfig) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return data.subscription.unsubscribe;
}

/**
 * Get user profile
 */
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data || null;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
}

/**
 * Get user conversations
 */
export async function getUserConversations(userId) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const conversations = data || [];

    if (conversations.length === 0) {
      return [];
    }

    const conversationIds = conversations.map((conversation) => conversation.id);
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds);

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const messageCounts = new Map();
    for (const message of messages || []) {
      messageCounts.set(
        message.conversation_id,
        (messageCounts.get(message.conversation_id) || 0) + 1,
      );
    }

    return sortConversations(
      conversations
        .map((conversation) => ({
          ...conversation,
          messageCount: messageCounts.get(conversation.id) || 0,
        }))
        .filter(
          (conversation) =>
            conversation.messageCount > 0 ||
            normalizeConversationTitle(conversation.title) !== DEFAULT_CONVERSATION_TITLE,
        ),
    );
  } catch (error) {
    console.error('Get conversations error:', error);
    return [];
  }
}

/**
 * Create conversation
 */
export async function createConversation(userId, title) {
  const normalizedTitle = normalizeConversationTitle(title) || DEFAULT_CONVERSATION_TITLE;

  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: normalizedTitle,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Create conversation error:', error);
    throw error;
  }
}

export async function updateConversation(userId, conversationId, updates) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Update conversation error:', error);
    throw error;
  }
}

export async function renameConversation(userId, conversationId, newTitle) {
  const normalizedTitle = normalizeConversationTitle(newTitle);

  if (!normalizedTitle) {
    throw new Error('Conversation title cannot be empty');
  }

  return updateConversation(userId, conversationId, {
    title: normalizedTitle.slice(0, MAX_CONVERSATION_TITLE_LENGTH),
  });
}

export async function deleteConversation(userId, conversationId) {
  try {
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (conversationError || !conversation) {
      throw new Error(conversationError?.message || 'Conversation not found');
    }

    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Delete conversation error:', error);
    throw error;
  }
}

/**
 * Get conversation messages
 */
export async function getConversationMessages(conversationId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

/**
 * Add feedback for a message
 */
export async function addFeedback(userId, messageId, type, content = null) {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        message_id: messageId,
        type,
        content,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Add feedback error:', error);
    throw error;
  }
}

/**
 * Get flashcard progress for a conversation
 */
export async function getFlashcardProgress(userId, conversationId) {
  try {
    const { data, error } = await supabase
      .from('flashcard_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);

    if (error) {
      // Gracefully handle missing table - return empty progress
      if (error.message?.includes('schema cache') || error.code === '42P01') {
        console.debug('Flashcard progress table not found, using local storage');
        return {};
      }
      throw new Error(error.message);
    }

    // Convert to a map for easy lookup by card_id
    const progressMap = {};
    for (const record of data || []) {
      progressMap[record.card_id] = {
        easeFactor: parseFloat(record.ease_factor),
        interval: record.interval,
        repetitions: record.repetitions,
        nextReviewDate: record.next_review_date,
        lastReviewDate: record.last_review_date,
        timesSeen: record.times_seen,
        timesCorrect: record.times_correct,
        lastRating: record.last_rating,
      };
    }

    return progressMap;
  } catch (error) {
    console.error('Get flashcard progress error:', error);
    return {};
  }
}

/**
 * Update flashcard progress after a review
 */
export async function updateFlashcardProgress(userId, conversationId, cardId, progressData) {
  try {
    const { data, error } = await supabase
      .from('flashcard_progress')
      .upsert({
        user_id: userId,
        conversation_id: conversationId,
        card_id: cardId,
        ease_factor: progressData.easeFactor,
        interval: progressData.interval,
        repetitions: progressData.repetitions,
        next_review_date: progressData.nextReviewDate,
        last_review_date: new Date().toISOString(),
        times_seen: progressData.timesSeen || 1,
        times_correct: progressData.timesCorrect || 0,
        last_rating: progressData.lastRating,
      }, {
        onConflict: 'user_id,conversation_id,card_id',
      })
      .select()
      .single();

    if (error) {
      // Gracefully handle missing table - just skip saving
      if (error.message?.includes('schema cache') || error.code === '42P01') {
        console.debug('Flashcard progress table not found, progress not saved');
        return null;
      }
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Update flashcard progress error:', error);
    return null; // Don't throw, just return null
  }
}

/**
 * Get count of cards due today across all conversations
 */
export async function getDueCardsCount(userId) {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const { count, error } = await supabase
      .from('flashcard_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', today.toISOString());

    if (error) {
      // Gracefully handle missing table
      if (error.message?.includes('schema cache') || error.code === '42P01') {
        return 0;
      }
      throw new Error(error.message);
    }

    return count || 0;
  } catch (error) {
    console.debug('Get due cards count error:', error.message);
    return 0;
  }
}

/**
 * Update assistant message learning content in DB
 * Fetches latest metadata first to prevent overwrites
 */
export async function updateAssistantMessageContent(conversationId, newLearningContent) {
  try {
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('id, metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !msg) {
      console.warn('No assistant message found to update');
      return null;
    }

    const existingLearningContent = msg.metadata?.learningContent || {};
    const mergedLearningContent = {
      ...existingLearningContent,
      ...newLearningContent,
    };

    const updatedMetadata = {
      ...msg.metadata,
      learningContent: mergedLearningContent
    };

    const { error: updateError } = await supabase
      .from('messages')
      .update({ metadata: updatedMetadata })
      .eq('id', msg.id);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Failed to update message content:', error);
    return null;
  }
}

/**
 * Get or create study streak for user
 */
export async function getStudyStreak(userId) {
  try {
    const { data, error } = await supabase
      .from('study_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data || {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: null,
      total_cards_reviewed: 0,
      total_study_days: 0,
    };
  } catch (error) {
    console.error('Get study streak error:', error);
    return {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: null,
      total_cards_reviewed: 0,
      total_study_days: 0,
    };
  }
}

/**
 * Update study streak after reviewing cards
 */
export async function updateStudyStreak(userId, cardsReviewed = 1) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get current streak data
    const { data: existing } = await supabase
      .from('study_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    let newStreak = 1;
    let longestStreak = 1;
    let totalDays = 1;
    let totalCards = cardsReviewed;

    if (existing) {
      totalCards = (existing.total_cards_reviewed || 0) + cardsReviewed;

      const lastStudyDate = existing.last_study_date;
      if (lastStudyDate) {
        const lastDate = new Date(lastStudyDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day, keep streak
          newStreak = existing.current_streak;
          totalDays = existing.total_study_days;
        } else if (diffDays === 1) {
          // Consecutive day, increment streak
          newStreak = (existing.current_streak || 0) + 1;
          totalDays = (existing.total_study_days || 0) + 1;
        } else {
          // Streak broken, reset to 1
          newStreak = 1;
          totalDays = (existing.total_study_days || 0) + 1;
        }
      }

      longestStreak = Math.max(existing.longest_streak || 0, newStreak);
    }

    const { data, error } = await supabase
      .from('study_streaks')
      .upsert({
        user_id: userId,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_study_date: today,
        total_cards_reviewed: totalCards,
        total_study_days: totalDays,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Update study streak error:', error);
    return null;
  }
}

export { hasSupabaseConfig };
export default supabase;
