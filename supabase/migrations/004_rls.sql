-- Migration: Comprehensive Row Level Security (RLS)
-- Consolidates and extends RLS policies for all tables
-- Idempotent: safely drops/recreates overlapping policies

-- ============================================================================
-- USER_PROFILES TABLE
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;

-- Create comprehensive policies
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_delete" ON user_profiles
  FOR DELETE USING (auth.uid() = id);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "conversations_delete" ON conversations;

-- Create comprehensive policies
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_delete" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

-- Create comprehensive policies (access via conversation ownership)
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can create own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON feedback;
DROP POLICY IF EXISTS "feedback_select" ON feedback;
DROP POLICY IF EXISTS "feedback_insert" ON feedback;
DROP POLICY IF EXISTS "feedback_update" ON feedback;
DROP POLICY IF EXISTS "feedback_delete" ON feedback;

-- Create comprehensive policies
CREATE POLICY "feedback_select" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "feedback_insert" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback_update" ON feedback
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback_delete" ON feedback
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- FACT_CHECKS TABLE
-- ============================================================================
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read fact checks" ON fact_checks;
DROP POLICY IF EXISTS "fact_checks_select" ON fact_checks;
DROP POLICY IF EXISTS "fact_checks_insert" ON fact_checks;

-- Fact checks are readable by authenticated users (cached data)
CREATE POLICY "fact_checks_select" ON fact_checks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can insert fact checks (backend only)
CREATE POLICY "fact_checks_insert" ON fact_checks
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ============================================================================
-- ASSET_CACHE TABLE
-- ============================================================================
ALTER TABLE asset_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read cached assets" ON asset_cache;
DROP POLICY IF EXISTS "asset_cache_select" ON asset_cache;
DROP POLICY IF EXISTS "asset_cache_insert" ON asset_cache;
DROP POLICY IF EXISTS "asset_cache_update" ON asset_cache;
DROP POLICY IF EXISTS "asset_cache_delete" ON asset_cache;

-- Asset cache is readable by all authenticated users (shared cache)
CREATE POLICY "asset_cache_select" ON asset_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role manages the cache (backend only)
CREATE POLICY "asset_cache_insert" ON asset_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "asset_cache_update" ON asset_cache
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "asset_cache_delete" ON asset_cache
  FOR DELETE USING (auth.role() = 'service_role');

-- ============================================================================
-- LEARNING_SESSIONS TABLE
-- ============================================================================
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own learning sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can create own learning sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can update own learning sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can delete own learning sessions" ON learning_sessions;
DROP POLICY IF EXISTS "learning_sessions_select" ON learning_sessions;
DROP POLICY IF EXISTS "learning_sessions_insert" ON learning_sessions;
DROP POLICY IF EXISTS "learning_sessions_update" ON learning_sessions;
DROP POLICY IF EXISTS "learning_sessions_delete" ON learning_sessions;

-- Create comprehensive policies
CREATE POLICY "learning_sessions_select" ON learning_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "learning_sessions_insert" ON learning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learning_sessions_update" ON learning_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learning_sessions_delete" ON learning_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TOPIC_PROGRESS TABLE
-- ============================================================================
ALTER TABLE topic_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own topic progress" ON topic_progress;
DROP POLICY IF EXISTS "Users can create own topic progress" ON topic_progress;
DROP POLICY IF EXISTS "Users can update own topic progress" ON topic_progress;
DROP POLICY IF EXISTS "Users can delete own topic progress" ON topic_progress;
DROP POLICY IF EXISTS "topic_progress_select" ON topic_progress;
DROP POLICY IF EXISTS "topic_progress_insert" ON topic_progress;
DROP POLICY IF EXISTS "topic_progress_update" ON topic_progress;
DROP POLICY IF EXISTS "topic_progress_delete" ON topic_progress;

-- Create comprehensive policies
CREATE POLICY "topic_progress_select" ON topic_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "topic_progress_insert" ON topic_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topic_progress_update" ON topic_progress
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topic_progress_delete" ON topic_progress
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- LEARNING_STATE_SNAPSHOTS TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_state_snapshots') THEN
    ALTER TABLE learning_state_snapshots ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies
    DROP POLICY IF EXISTS "learning_state_snapshots_select" ON learning_state_snapshots;
    DROP POLICY IF EXISTS "learning_state_snapshots_insert" ON learning_state_snapshots;

    -- Create policies
    CREATE POLICY "learning_state_snapshots_select" ON learning_state_snapshots
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "learning_state_snapshots_insert" ON learning_state_snapshots
      FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant select, insert, update, delete on user-owned tables
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON topic_progress TO authenticated;

-- Grant read access to cached/shared tables
GRANT SELECT ON fact_checks TO authenticated;
GRANT SELECT, INSERT ON asset_cache TO authenticated;

-- Grant read access to views
GRANT SELECT ON user_learning_summary TO authenticated;
GRANT SELECT ON asset_cache_stats TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE user_profiles IS 'User profile data with RLS - users can only access their own profile';
COMMENT ON TABLE conversations IS 'Chat conversations with RLS - users can only access their own conversations';
COMMENT ON TABLE messages IS 'Chat messages with RLS - accessible via conversation ownership';
COMMENT ON TABLE feedback IS 'User feedback with RLS - users can only access their own feedback';
COMMENT ON TABLE fact_checks IS 'Cached fact check results - readable by all authenticated users';
COMMENT ON TABLE asset_cache IS 'Cached AI-generated assets - shared cache readable by all authenticated users';
COMMENT ON TABLE learning_sessions IS 'Learning session data with RLS - users can only access their own sessions';
COMMENT ON TABLE topic_progress IS 'Topic progress tracking with RLS - users can only access their own progress';
