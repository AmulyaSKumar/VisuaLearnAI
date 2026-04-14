import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
}

/**
 * Supabase client with service role key
 * Used for backend operations (bypasses RLS for server-side logic)
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Upload base64-encoded image to Supabase Storage
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} filename - Target filename (e.g., "chart-123.png")
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadImage(base64Data, filename) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error: uploadError } = await supabase.storage
      .from('lesson-assets')
      .upload(`images/${filename}`, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('lesson-assets')
      .getPublicUrl(`images/${filename}`);

    return publicUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
}

/**
 * Get current session (admin context)
 * Used by backend to validate tokens or test auth
 * @returns {Promise<Object>} { session, user }
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      // No authenticated user in this context (expected for backend)
      return { session: null, user: null };
    }

    return { session: null, user: data.user };
  } catch (error) {
    console.error('Get session error:', error);
    return { session: null, user: null };
  }
}

/**
 * Create user profile after sign-up
 * @param {string} userId - Auth user ID
 * @returns {Promise<Object>} Created profile
 */
export async function createUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        learning_style: 'visual',
        detected_styles: {
          visual: 0.25,
          auditory: 0.25,
          reading: 0.25,
          kinesthetic: 0.25,
        },
        preferred_language: 'en',
        comprehension_level: 'intermediate',
        pace_preference: 'normal',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('User profile creation error:', error);
    throw error;
  }
}

/**
 * Get user profile with all settings
 * @param {string} userId - Auth user ID
 * @returns {Promise<Object>} User profile
 */
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error('Fetch user profile error:', error);
    throw error;
  }
}

/**
 * Update user profile
 * @param {string} userId - Auth user ID
 * @param {Object} updates - Profile fields to update
 * @returns {Promise<Object>} Updated profile
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
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
}

/**
 * Create conversation
 * @param {string} userId - Auth user ID
 * @param {string} title - Conversation title
 * @returns {Promise<Object>} Created conversation
 */
export async function createConversation(userId, title) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Create conversation error:', error);
    throw error;
  }
}

/**
 * Get user's conversations
 * @param {string} userId - Auth user ID
 * @returns {Promise<Array>} User's conversations
 */
export async function getUserConversations(userId) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Fetch conversations error:', error);
    throw error;
  }
}

/**
 * Add message to conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} role - 'user' | 'assistant' | 'system'
 * @param {string} content - Message content
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created message
 */
export async function addMessage(conversationId, role, content, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Add message error:', error);
    throw error;
  }
}

/**
 * Get conversation messages
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} Messages in conversation
 */
export async function getConversationMessages(conversationId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Fetch messages error:', error);
    throw error;
  }
}

/**
 * Save feedback for a message
 * @param {string} userId - Auth user ID
 * @param {string} messageId - Message ID
 * @param {string} type - 'thumbs_up' | 'thumbs_down' | 'correction' | 'suggestion'
 * @param {string} content - Feedback content
 * @returns {Promise<Object>} Saved feedback
 */
export async function saveFeedback(userId, messageId, type, content = null) {
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
      throw new Error(`Failed to save feedback: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Save feedback error:', error);
    throw error;
  }
}

/**
 * Check if asset is cached (by prompt hash)
 * @param {string} promptHash - Hash of the prompt
 * @returns {Promise<Object|null>} Cached asset or null
 */
export async function getCachedAsset(promptHash) {
  try {
    const { data, error } = await supabase
      .from('asset_cache')
      .select('*')
      .eq('prompt_hash', promptHash)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch cached asset: ${error.message}`);
    }

    // Increment access count if found
    if (data) {
      try {
        await supabase
          .from('asset_cache')
          .update({ access_count: data.access_count + 1 })
          .eq('id', data.id);
      } catch (err) {
        console.warn('Failed to update asset access count:', err.message);
      }
    }

    return data || null;
  } catch (error) {
    console.error('Get cached asset error:', error);
    throw error;
  }
}

/**
 * Cache generated asset
 * @param {string} promptHash - Hash of the prompt
 * @param {string} assetType - 'widget' | 'image' | 'simulation'
 * @param {string} content - Asset content (HTML, base64, JSON)
 * @param {string} storagePath - Storage path if applicable
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Cached asset record
 */
export async function cacheAsset(promptHash, assetType, content, storagePath = null, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('asset_cache')
      .insert({
        prompt_hash: promptHash,
        asset_type: assetType,
        content,
        storage_path: storagePath,
        metadata,
        access_count: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cache asset: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Cache asset error:', error);
    throw error;
  }
}

/**
 * Save fact check results
 * @param {string} messageId - Message ID
 * @param {Array} claims - Extracted claims
 * @param {Array} verificationResults - Verification results
 * @param {number} confidenceScore - Overall confidence (0-1)
 * @param {Array} sources - Citation sources
 * @returns {Promise<Object>} Fact check record
 */
export async function saveFactCheck(messageId, claims, verificationResults, confidenceScore, sources = []) {
  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .insert({
        message_id: messageId,
        claims,
        verification_results: verificationResults,
        confidence_score: confidenceScore,
        sources,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save fact check: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Save fact check error:', error);
    throw error;
  }
}

export default supabase;
