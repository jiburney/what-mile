-- One-Decimal Scoring Precision
-- Version 7: Widen daily_scores columns from INTEGER to NUMERIC(6,1) to
-- store fractional scores now that calculateScore() (src/utils/scoring.ts)
-- returns unrounded floats instead of integers, and update the total_score
-- CHECK constraint to this year's MAX_SCORE (2197.9, was 2200).
--
-- Run this manually in the Supabase SQL editor after schema-v6.sql.
--
-- IMPORTANT: apply this BEFORE deploying the frontend/API changes from this
-- branch. Once deployed, score submissions will contain decimal values —
-- Postgres rejects decimal inserts into an INTEGER column outright, so
-- Daily Challenge score submission will fail with a database error until
-- this migration has been run.

ALTER TABLE daily_scores
  ALTER COLUMN total_score TYPE NUMERIC(6,1);

ALTER TABLE daily_scores
  ALTER COLUMN round_scores TYPE NUMERIC(6,1)[];

-- Replace the total_score bound (2200 → 2197.9). Assumes the default
-- Postgres-generated constraint name for the original inline CHECK in
-- schema-v6.sql; if this DROP has no effect, find the actual name with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'daily_scores'::regclass;
ALTER TABLE daily_scores
  DROP CONSTRAINT IF EXISTS daily_scores_total_score_check;

ALTER TABLE daily_scores
  ADD CONSTRAINT daily_scores_total_score_check
  CHECK (total_score >= 0 AND total_score <= 2197.9);
