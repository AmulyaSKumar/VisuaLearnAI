-- Flashcard Progress Table for SM-2 Spaced Repetition
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,

  -- SM-2 Algorithm Fields
  ease_factor DECIMAL(3,2) DEFAULT 2.5,  -- Starts at 2.5, min 1.3
  interval INTEGER DEFAULT 0,             -- Days until next review
  repetitions INTEGER DEFAULT 0,          -- Number of successful reviews
  next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_review_date TIMESTAMP WITH TIME ZONE,

  -- Stats
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_rating INTEGER,                    -- Last quality rating (1-5)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one progress record per user per card per conversation
  UNIQUE(user_id, conversation_id, card_id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_id ON flashcard_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_next_review ON flashcard_progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_conversation ON flashcard_progress(conversation_id);

-- Row Level Security
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own flashcard progress
CREATE POLICY "Users can view own flashcard progress"
  ON flashcard_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcard progress"
  ON flashcard_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcard progress"
  ON flashcard_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcard progress"
  ON flashcard_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_flashcard_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flashcard_progress_updated_at
  BEFORE UPDATE ON flashcard_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_flashcard_progress_updated_at();

-- Study Streaks Table
CREATE TABLE IF NOT EXISTS study_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  total_cards_reviewed INTEGER DEFAULT 0,
  total_study_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for study_streaks
ALTER TABLE study_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study streaks"
  ON study_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study streaks"
  ON study_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study streaks"
  ON study_streaks FOR UPDATE
  USING (auth.uid() = user_id);
