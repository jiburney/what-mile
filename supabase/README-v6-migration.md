# Daily Challenge Schema Migration (v6)

## Overview
This migration adds database support for the Daily Challenge feature, including:
- `daily_challenges` table for storing each day's 5 photos
- `daily_scores` table for the anonymous leaderboard
- `last_daily_used_at` column on `photos` for cooldown tracking

## How to Apply

### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `schema-v6.sql`
5. Click **Run**

### Option 2: Node.js Migration Script

```bash
cd /Users/jamesburney/dev/projects/what-mile
node scripts/apply-daily-challenge-schema.mjs
```

**Note:** This script attempts to run DDL via RPC, which may not work on all Supabase instances. If it fails, use Option 1 instead.

## Verification

After applying the migration, verify the tables were created:

```sql
-- Check daily_challenges table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_challenges'
ORDER BY ordinal_position;

-- Check daily_scores table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_scores'
ORDER BY ordinal_position;

-- Check photos table has new column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'photos' AND column_name = 'last_daily_used_at';
```

## Tables Created

### `daily_challenges`
- `id` (UUID, primary key)
- `challenge_date` (DATE, unique) — YYYY-MM-DD in Eastern timezone
- `photo_ids` (UUID[]) — Array of exactly 5 photo IDs
- `created_at` (TIMESTAMPTZ)

### `daily_scores`
- `id` (UUID, primary key)
- `challenge_id` (UUID, foreign key → daily_challenges.id)
- `total_score` (INTEGER, 0-2200)
- `overall_tier` (TEXT, one of: 'Thru-Hiker', 'LASHer', 'Section Hiker', 'Day Hiker')
- `round_scores` (INTEGER[]) — Array of 5 round scores
- `player_name` (TEXT, nullable)
- `year_hiked` (INTEGER, nullable)
- `submitted_at` (TIMESTAMPTZ)
- `client_fingerprint` (TEXT) — localStorage UUID for replay prevention
- **UNIQUE constraint:** (challenge_id, client_fingerprint)

### `photos` (new column)
- `last_daily_used_at` (TIMESTAMPTZ, nullable) — Tracks when photo was last used in a daily challenge

## Rollback

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS daily_scores CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
ALTER TABLE photos DROP COLUMN IF EXISTS last_daily_used_at;
```
