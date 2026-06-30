-- Daily Challenge Mode Schema
-- Version 6: Add daily challenges, leaderboard, and photo cooldown tracking

-- Table: daily_challenges
-- One row per calendar date, stores the 5 photos for that day's challenge
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,  -- YYYY-MM-DD in Eastern timezone
  photo_ids UUID[] NOT NULL,            -- Exactly 5 photo IDs
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_date
ON daily_challenges(challenge_date DESC);

-- Table: daily_scores
-- Anonymous leaderboard entries for each daily challenge
CREATE TABLE IF NOT EXISTS daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 2200),
  overall_tier TEXT NOT NULL CHECK (overall_tier IN ('Thru-Hiker', 'LASHer', 'Section Hiker', 'Day Hiker')),
  round_scores INTEGER[] NOT NULL,      -- [440, 352, 220, ...]
  player_name TEXT,                     -- Optional: "Trail Name" or "First L."
  year_hiked INTEGER CHECK (year_hiked IS NULL OR (year_hiked >= 1900 AND year_hiked <= 2100)),
  submitted_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate submissions from same browser
  client_fingerprint TEXT NOT NULL,
  UNIQUE(challenge_id, client_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_challenge
ON daily_scores(challenge_id, total_score DESC);

CREATE INDEX IF NOT EXISTS idx_daily_scores_submitted
ON daily_scores(submitted_at DESC);

-- Add column to existing photos table for cooldown tracking
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS last_daily_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_photos_daily_cooldown
ON photos(last_daily_used_at)
WHERE status = 'approved';
