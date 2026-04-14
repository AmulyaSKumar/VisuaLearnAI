/**
 * Supabase Adapter Layer
 * All database operations for memory management
 * Delegates to @supabase/supabase-js via database/client.js
 */

export {
  // User profile operations
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  // Conversation operations
  createConversation,
  getUserConversations,
  // Message operations
  addMessage,
  getConversationMessages,
  // Feedback operations
  saveFeedback,
  // Asset cache operations
  getCachedAsset,
  cacheAsset,
  // Fact checking operations
  saveFactCheck,
  // Storage operations
  uploadImage,
} from '../../database/client.js';

// Re-export all from the main supabase client
export { supabase } from '../../database/client.js';

/**
 * Helper: Get user's recent activity for context
 * Used by agents to understand user engagement patterns
 */
export async function getUserActivity(userId, limit = 50) {
  const { supabase } = await import('../lib/supabase.js');

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        created_at,
        role,
        content,
        conversation_id
      `)
      .in(
        'conversation_id',
        // Get conversations for this user
        (
          await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
        ).data?.map(c => c.id) || []
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch user activity: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Get user activity error:', error);
    throw error;
  }
}

/**
 * Helper: Get all feedback for a user
 * Used for improvement and adaptation
 */
export async function getUserFeedback(userId) {
  const { supabase } = await import('../lib/supabase.js');

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user feedback: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Get user feedback error:', error);
    throw error;
  }
}

/**
 * Helper: Get asset cache statistics
 * Shows which assets are most used (for optimization)
 */
export async function getAssetCacheStats() {
  const { supabase } = await import('../lib/supabase.js');

  try {
    const { data, error } = await supabase
      .from('asset_cache')
      .select('asset_type, access_count')
      .order('access_count', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch asset stats: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Get asset cache stats error:', error);
    throw error;
  }
}

export default {
  // All exports are re-exported at the top
};
