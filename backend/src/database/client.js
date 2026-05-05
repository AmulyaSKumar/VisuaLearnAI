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

// ============================================
// LEARNING RESOURCES (Persistent tabs)
// ============================================

/**
 * Resource types for learning content
 */
export const RESOURCE_TYPES = {
  LEARN: 'learn',
  SIMULATION: 'simulation',
  VISUALIZATION: 'visualization',
  FLASHCARDS: 'flashcards',
  MINDMAP: 'mindmap',
  QUIZ: 'quiz',
  EXAMPLES: 'examples',
};

/**
 * Save a learning resource for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID that triggered generation (optional)
 * @param {string} resourceType - Type of resource (learn, simulation, flashcards, etc.)
 * @param {string} topic - Topic/query that generated this resource
 * @param {Object} content - Generated content
 * @returns {Promise<Object>} Saved resource
 */
export async function saveLearningResource(conversationId, messageId, resourceType, topic, content) {
  try {
    // Check if resource already exists for this conversation + type + topic
    const { data: existing } = await supabase
      .from('learning_resources')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('resource_type', resourceType)
      .eq('topic', topic)
      .single();

    if (existing) {
      // Update existing resource
      const { data, error } = await supabase
        .from('learning_resources')
        .update({
          content,
          message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Create new resource
    const { data, error } = await supabase
      .from('learning_resources')
      .insert({
        conversation_id: conversationId,
        message_id: messageId,
        resource_type: resourceType,
        topic,
        content,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save learning resource: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Save learning resource error:', error);
    throw error;
  }
}

/**
 * Get all learning resources for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} Array of resources
 */
export async function getConversationResources(conversationId) {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch learning resources: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Fetch learning resources error:', error);
    throw error;
  }
}

/**
 * Get a specific resource type for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} resourceType - Type of resource
 * @param {string} topic - Optional topic filter
 * @returns {Promise<Object|null>} Resource or null
 */
export async function getResource(conversationId, resourceType, topic = null) {
  try {
    let query = supabase
      .from('learning_resources')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('resource_type', resourceType);

    if (topic) {
      query = query.eq('topic', topic);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch resource: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('Get resource error:', error);
    throw error;
  }
}

/**
 * Get available resource types for a conversation (for tab rendering)
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array<string>>} Array of resource types
 */
export async function getAvailableResourceTypes(conversationId) {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .select('resource_type')
      .eq('conversation_id', conversationId);

    if (error) {
      throw new Error(`Failed to fetch resource types: ${error.message}`);
    }

    // Return unique resource types
    const types = [...new Set((data || []).map(r => r.resource_type))];
    return types;
  } catch (error) {
    console.error('Get available resource types error:', error);
    throw error;
  }
}

/**
 * Delete a learning resource
 * @param {string} resourceId - Resource ID
 * @returns {Promise<void>}
 */
export async function deleteLearningResource(resourceId) {
  try {
    const { error } = await supabase
      .from('learning_resources')
      .delete()
      .eq('id', resourceId);

    if (error) {
      throw new Error(`Failed to delete learning resource: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete learning resource error:', error);
    throw error;
  }
}

// ============================================
// PERSONAS (AI Personality System)
// ============================================

/**
 * Get all personas (user's custom + system personas)
 * @param {string} userId - Auth user ID
 * @returns {Promise<Array>} Array of personas
 */
export async function getPersonas(userId) {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch personas: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Fetch personas error:', error);
    throw error;
  }
}

/**
 * Get a single persona by ID
 * @param {string} personaId - Persona ID
 * @returns {Promise<Object|null>} Persona or null
 */
export async function getPersona(personaId) {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch persona: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error('Fetch persona error:', error);
    throw error;
  }
}

/**
 * Get the default system persona (Friendly Tutor)
 * @returns {Promise<Object|null>} Default system persona
 */
export async function getDefaultSystemPersona() {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('is_system', true)
      .eq('name', 'Friendly Tutor')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch default persona: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error('Fetch default persona error:', error);
    throw error;
  }
}

/**
 * Create a custom persona
 * @param {string} userId - Auth user ID
 * @param {Object} personaData - Persona data
 * @returns {Promise<Object>} Created persona
 */
export async function createPersona(userId, personaData) {
  try {
    // Check max personas limit
    const { count, error: countError } = await supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw new Error(`Failed to check persona count: ${countError.message}`);
    }

    const MAX_PERSONAS_PER_USER = 15;
    if (count >= MAX_PERSONAS_PER_USER) {
      throw new Error(`Maximum ${MAX_PERSONAS_PER_USER} custom personas allowed`);
    }

    const { data, error } = await supabase
      .from('personas')
      .insert({
        user_id: userId,
        name: personaData.name,
        description: personaData.description || '',
        system_prompt_prefix: personaData.system_prompt_prefix || '',
        tone: personaData.tone || 'friendly',
        verbosity: personaData.verbosity || 'medium',
        strength: personaData.strength ?? 80,
        rules: personaData.rules || [],
        avoid_rules: personaData.avoid_rules || [],
        example_responses: personaData.example_responses || [],
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create persona: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Create persona error:', error);
    throw error;
  }
}

/**
 * Update a custom persona
 * @param {string} personaId - Persona ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated persona
 */
export async function updatePersona(personaId, updates) {
  try {
    // First check if persona is system (can't be updated)
    const existing = await getPersona(personaId);
    if (!existing) {
      throw new Error('Persona not found');
    }
    if (existing.is_system) {
      throw new Error('System personas cannot be modified');
    }

    // Increment version on update
    const { data, error } = await supabase
      .from('personas')
      .update({
        ...updates,
        version: existing.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personaId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update persona: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Update persona error:', error);
    throw error;
  }
}

/**
 * Delete a custom persona
 * @param {string} userId - Auth user ID (for safety check)
 * @param {string} personaId - Persona ID
 * @returns {Promise<void>}
 */
export async function deletePersona(userId, personaId) {
  try {
    // Check if persona exists and is owned by user
    const existing = await getPersona(personaId);
    if (!existing) {
      throw new Error('Persona not found');
    }
    if (existing.is_system) {
      throw new Error('System personas cannot be deleted');
    }
    if (existing.user_id !== userId) {
      throw new Error('Cannot delete another user\'s persona');
    }

    // Check if this is user's default persona
    const profile = await getUserProfile(userId);
    if (profile?.default_persona_id === personaId) {
      // Set fallback to default system persona
      const fallback = await getDefaultSystemPersona();
      if (fallback) {
        await setDefaultPersona(userId, fallback.id);
      }
    }

    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', personaId);

    if (error) {
      throw new Error(`Failed to delete persona: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete persona error:', error);
    throw error;
  }
}

/**
 * Set user's default persona
 * @param {string} userId - Auth user ID
 * @param {string} personaId - Persona ID to set as default
 * @returns {Promise<Object>} Updated profile
 */
export async function setDefaultPersona(userId, personaId) {
  try {
    // Verify persona exists
    const persona = await getPersona(personaId);
    if (!persona) {
      throw new Error('Persona not found');
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        default_persona_id: personaId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set default persona: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Set default persona error:', error);
    throw error;
  }
}

/**
 * Get user's default persona
 * @param {string} userId - Auth user ID
 * @returns {Promise<Object|null>} Default persona or null
 */
export async function getUserDefaultPersona(userId) {
  try {
    const profile = await getUserProfile(userId);
    if (!profile?.default_persona_id) {
      return null;
    }

    return await getPersona(profile.default_persona_id);
  } catch (error) {
    console.error('Get user default persona error:', error);
    throw error;
  }
}

/**
 * Update conversation with persona info
 * @param {string} conversationId - Conversation ID
 * @param {string} personaId - Persona ID
 * @param {number} personaVersion - Persona version at time of creation
 * @returns {Promise<Object>} Updated conversation
 */
export async function setConversationPersona(conversationId, personaId, personaVersion) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        persona_id: personaId,
        persona_version: personaVersion,
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set conversation persona: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Set conversation persona error:', error);
    throw error;
  }
}

export default supabase;
