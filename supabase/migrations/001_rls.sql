-- =============================================================================
-- Row Level Security (RLS) Migration
-- Enables RLS on all tables and creates policies for secure access
-- Run this in Supabase SQL editor
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_cache ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USER_PROFILES Table Policies
-- Users can only SELECT and UPDATE their own profile
-- =============================================================================

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert their own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- =============================================================================
-- CONVERSATIONS Table Policies
-- Users can only CRUD their own conversations
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own conversations
CREATE POLICY "Users can create their own conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update their own conversations"
ON conversations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations"
ON conversations FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- MESSAGES Table Policies
-- Users can only access messages via conversation ownership
-- =============================================================================

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;

-- Users can view messages in their own conversations
CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- Users can insert messages in their own conversations
CREATE POLICY "Users can insert messages in their conversations"
ON messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- Users can update messages in their own conversations
CREATE POLICY "Users can update messages in their conversations"
ON messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- Users can delete messages in their own conversations
CREATE POLICY "Users can delete messages in their conversations"
ON messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- =============================================================================
-- FEEDBACK Table Policies
-- Users can INSERT and SELECT their own feedback
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback;

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON feedback FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- FACT_CHECKS Table Policies
-- Readable by message owner only (via conversation ownership)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view fact checks for their messages" ON fact_checks;

-- Users can view fact checks for messages in their conversations
CREATE POLICY "Users can view fact checks for their messages"
ON fact_checks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON conversations.id = messages.conversation_id
    WHERE messages.id = fact_checks.message_id
    AND conversations.user_id = auth.uid()
  )
);

-- =============================================================================
-- ASSET_CACHE Table Policies
-- Readable by all authenticated users (shared cache)
-- Writable by service role only (handled by backend)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can view cached assets" ON asset_cache;
DROP POLICY IF EXISTS "Service role can manage asset cache" ON asset_cache;

-- All authenticated users can read from asset cache (shared)
CREATE POLICY "Authenticated users can view cached assets"
ON asset_cache FOR SELECT
USING (auth.role() = 'authenticated');

-- Only service role can insert/update/delete (backend operations)
-- Note: Service role bypasses RLS, so no explicit policy needed
-- But we add this for clarity and in case service_role key is used

-- =============================================================================
-- Indexes for RLS performance
-- =============================================================================

-- Index on conversations.user_id for faster RLS checks
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Index on messages.conversation_id for faster RLS subquery
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Index on feedback.user_id for faster RLS checks
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Index on fact_checks.message_id for faster RLS subquery
CREATE INDEX IF NOT EXISTS idx_fact_checks_message_id ON fact_checks(message_id);

-- =============================================================================
-- Grant statements (ensure proper access)
-- =============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant select on tables for authenticated users
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT ON feedback TO authenticated;
GRANT SELECT ON fact_checks TO authenticated;
GRANT SELECT ON asset_cache TO authenticated;

-- =============================================================================
-- Verify RLS is enabled
-- =============================================================================

-- This query shows RLS status for all tables (run separately to verify)
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('user_profiles', 'conversations', 'messages', 'feedback', 'fact_checks', 'asset_cache');
