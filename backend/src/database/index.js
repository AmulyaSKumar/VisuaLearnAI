/**
 * Database Module
 * Supabase client and database operations
 * @module database
 */

export { supabase, createUserProfile, getUserProfile, updateUserProfile, createConversation, getUserConversations, addMessage, getConversationMessages, saveFeedback, getCachedAsset, cacheAsset, saveFactCheck, uploadImage, getSession } from './client.js';
