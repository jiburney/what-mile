-- Verification Query for Daily Challenge Schema Migration
-- Run this in Supabase SQL Editor to confirm everything is set up correctly

SELECT
  'daily_challenges table' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'daily_challenges'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  'daily_scores table',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'daily_scores'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT
  'photos.last_daily_used_at column',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'photos' AND column_name = 'last_daily_used_at'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT
  'daily_challenges indexes',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'daily_challenges' AND indexname LIKE 'idx_%'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT
  'daily_scores indexes',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'daily_scores' AND indexname LIKE 'idx_%'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END;
