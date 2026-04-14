-- Migration: Learning Progress Persistence
-- Stores user learning sessions and topic-level progress for cross-session continuity

-- Learning sessions table
-- Tracks each learning session with cognitive state transitions
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  initial_state TEXT NOT NULL DEFAULT 'flow',
  final_state TEXT,
  topics_covered TEXT[] DEFAULT '{}',
  interaction_count INTEGER DEFAULT 0,
  effectiveness_score NUMERIC(3,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Topic progress table
-- Tracks per-topic learning progress and cognitive states
CREATE TABLE IF NOT EXISTS topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  cognitive_state TEXT NOT NULL DEFAULT 'flow',
  mastery_level NUMERIC(3,2) DEFAULT 0.0,
  attempt_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  avg_effectiveness NUMERIC(3,2) DEFAULT 0.5,
  avg_engagement NUMERIC(3,2) DEFAULT 0.5,
  time_spent_seconds INTEGER DEFAULT 0,
  state_history JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

-- Learning state snapshots
-- Point-in-time snapshots of learning state for analytics
CREATE TABLE IF NOT EXISTS learning_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
  topic TEXT,
  cognitive_state TEXT NOT NULL,
  effectiveness NUMERIC(3,2),
  engagement NUMERIC(3,2),
  source TEXT DEFAULT 'chat',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_started_at ON learning_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_id ON topic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_topic ON topic_progress(topic);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_topic ON topic_progress(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_learning_state_snapshots_user_id ON learning_state_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_state_snapshots_created_at ON learning_state_snapshots(created_at DESC);

-- Row Level Security
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_state_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_sessions
CREATE POLICY "Users can view own sessions"
  ON learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for topic_progress
CREATE POLICY "Users can view own progress"
  ON topic_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON topic_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON topic_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for learning_state_snapshots
CREATE POLICY "Users can view own snapshots"
  ON learning_state_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON learning_state_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update topic progress updated_at
CREATE OR REPLACE FUNCTION update_topic_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS topic_progress_updated_at ON topic_progress;
CREATE TRIGGER topic_progress_updated_at
  BEFORE UPDATE ON topic_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_topic_progress_updated_at();

-- Function to calculate mastery level
CREATE OR REPLACE FUNCTION calculate_mastery_level(
  p_success_count INTEGER,
  p_attempt_count INTEGER,
  p_avg_effectiveness NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  success_rate NUMERIC;
  mastery NUMERIC;
BEGIN
  IF p_attempt_count = 0 THEN
    RETURN 0.0;
  END IF;

  success_rate := p_success_count::NUMERIC / p_attempt_count;
  -- Weighted combination: 60% success rate + 40% effectiveness
  mastery := (success_rate * 0.6) + (COALESCE(p_avg_effectiveness, 0.5) * 0.4);

  RETURN LEAST(1.0, GREATEST(0.0, mastery));
END;
$$ LANGUAGE plpgsql;

-- View for user learning dashboard
CREATE OR REPLACE VIEW user_learning_summary AS
SELECT
  tp.user_id,
  COUNT(DISTINCT tp.topic) as total_topics,
  AVG(tp.mastery_level) as avg_mastery,
  SUM(tp.time_spent_seconds) as total_time_seconds,
  SUM(tp.attempt_count) as total_attempts,
  COUNT(DISTINCT CASE WHEN tp.mastery_level >= 0.8 THEN tp.topic END) as mastered_topics,
  COUNT(DISTINCT CASE WHEN tp.cognitive_state = 'struggling' THEN tp.topic END) as struggling_topics,
  MAX(tp.updated_at) as last_activity
FROM topic_progress tp
GROUP BY tp.user_id;

-- Grant access to the view
GRANT SELECT ON user_learning_summary TO authenticated;
