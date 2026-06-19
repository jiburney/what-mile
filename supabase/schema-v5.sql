-- Migration v5: Add triage_reason column to photos table
-- Stores the AI-generated reasoning from Haiku triage for display on review/skip cards

ALTER TABLE photos ADD COLUMN IF NOT EXISTS triage_reason TEXT;

COMMENT ON COLUMN photos.triage_reason IS 'Claude Haiku triage explanation for why this photo was classified as ready/review/skip';
