import * as supabaseAdapter from './adapter.js';

/**
 * MemoryManager: High-level facade for memory operations
 * Manages user context, conversation history, and persistent state
 *
 * Three-tier architecture:
 * 1. Session memory (current chat context in request)
 * 2. Private memory (user's personal history in Supabase)
 * 3. Shared memory (system-wide knowledge for adaptation)
 */
export class MemoryManager {
  constructor(userId = null) {
    this.userId = userId;
    this.sessionMemory = {
      currentConversation: null,
      messages: [],
      messageHistory: [],
    };
  }

  /**
   * Initialize memory manager with user context
   * Loads user profile, conversations, and recent messages
   */
  async initialize() {
    if (!this.userId) {
      throw new Error('Cannot initialize MemoryManager without userId');
    }

    try {
      // Load user profile
      const profile = await supabaseAdapter.getUserProfile(this.userId);
      this.userProfile = profile || (await supabaseAdapter.createUserProfile(this.userId));

      // Load user's conversations
      const conversations = await supabaseAdapter.getUserConversations(this.userId);
      this.conversations = conversations;

      return {
        success: true,
        profile: this.userProfile,
        conversationCount: conversations.length,
      };
    } catch (error) {
      console.error('MemoryManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load a specific conversation with its messages
   */
  async loadConversation(conversationId) {
    try {
      const messages = await supabaseAdapter.getConversationMessages(conversationId);
      this.sessionMemory.currentConversation = conversationId;
      this.sessionMemory.messages = messages;
      this.sessionMemory.messageHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      return messages;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    }
  }

  /**
   * Create new conversation
   */
  async createConversation(title) {
    try {
      const conversation = await supabaseAdapter.createConversation(this.userId, title);
      this.sessionMemory.currentConversation = conversation.id;
      this.sessionMemory.messages = [];
      this.conversations = [...(this.conversations || []), conversation];

      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Add user message to current conversation
   */
  async addUserMessage(content, metadata = {}) {
    if (!this.sessionMemory.currentConversation) {
      throw new Error('No current conversation set');
    }

    try {
      const message = await supabaseAdapter.addMessage(
        this.sessionMemory.currentConversation,
        'user',
        content,
        { ...metadata, timestamp: new Date().toISOString() }
      );

      this.sessionMemory.messages.push(message);
      this.sessionMemory.messageHistory.push({
        role: 'user',
        content,
      });

      return message;
    } catch (error) {
      console.error('Failed to add user message:', error);
      throw error;
    }
  }

  /**
   * Add assistant message to current conversation
   */
  async addAssistantMessage(content, metadata = {}) {
    if (!this.sessionMemory.currentConversation) {
      throw new Error('No current conversation set');
    }

    try {
      const message = await supabaseAdapter.addMessage(
        this.sessionMemory.currentConversation,
        'assistant',
        content,
        { ...metadata, timestamp: new Date().toISOString() }
      );

      this.sessionMemory.messages.push(message);
      this.sessionMemory.messageHistory.push({
        role: 'assistant',
        content,
      });

      return message;
    } catch (error) {
      console.error('Failed to add assistant message:', error);
      throw error;
    }
  }

  /**
   * Get formatted message history for chat APIs
   * Excludes system messages, includes only role/content
   */
  getMessageHistory() {
    return this.sessionMemory.messageHistory;
  }

  /**
   * Get current user profile
   */
  getUserProfile() {
    return this.userProfile;
  }

  /**
   * Update user profile (learning style, preferences, etc.)
   */
  async updateUserProfile(updates) {
    try {
      const updated = await supabaseAdapter.updateUserProfile(this.userId, updates);
      this.userProfile = updated;
      return updated;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Save feedback for a message
   */
  async saveFeedback(messageId, type, content = null) {
    try {
      return await supabaseAdapter.saveFeedback(this.userId, messageId, type, content);
    } catch (error) {
      console.error('Failed to save feedback:', error);
      throw error;
    }
  }

  /**
   * Get cached asset by prompt hash
   */
  async getCachedAsset(promptHash) {
    try {
      return await supabaseAdapter.getCachedAsset(promptHash);
    } catch (error) {
      console.error('Failed to get cached asset:', error);
      return null;
    }
  }

  /**
   * Cache a generated asset
   */
  async cacheAsset(promptHash, assetType, content, storagePath = null, metadata = {}) {
    try {
      return await supabaseAdapter.cacheAsset(
        promptHash,
        assetType,
        content,
        storagePath,
        metadata
      );
    } catch (error) {
      console.error('Failed to cache asset:', error);
      throw error;
    }
  }

  /**
   * Save fact check results
   */
  async saveFactCheck(messageId, claims, verificationResults, confidenceScore, sources = []) {
    try {
      return await supabaseAdapter.saveFactCheck(
        messageId,
        claims,
        verificationResults,
        confidenceScore,
        sources
      );
    } catch (error) {
      console.error('Failed to save fact check:', error);
      throw error;
    }
  }

  /**
   * Get learning context for personalization
   * Combines user profile, history patterns, and engagement metrics
   */
  getLearningContext() {
    return {
      userId: this.userId,
      profile: this.userProfile,
      recentMessages: this.sessionMemory.messages.slice(-10), // Last 10 messages
      conversationCount: this.conversations?.length || 0,
      messageCount: this.sessionMemory.messages.length,
      learningStyle: this.userProfile?.learning_style,
      comprehensionLevel: this.userProfile?.comprehension_level,
      topicsOfInterest: this.userProfile?.topics_of_interest || [],
      strugglingTopics: this.userProfile?.struggling_topics || [],
    };
  }
}

export default MemoryManager;
