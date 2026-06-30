# Daily Challenge Implementation Summary

## What Was Built

A complete Daily Challenge mode for What Mile? where all players get the same 5 photos each day and can compete on a shared leaderboard.

### Backend (API)

**New Files:**
- `api/daily.ts` — Action-routed endpoint with 3 actions:
  - `get-challenge` — Returns today's challenge (creates if doesn't exist)
  - `submit-score` — Validates and saves player score
  - `get-leaderboard` — Returns top 5 + your rank + total players
- `api/_lib/seeded-random.ts` — Deterministic PRNG for reproducible photo selection
- `api/_lib/distance.ts` — Server-side Haversine distance calculation
- `api/_lib/select-daily-photos.ts` — Photo selection algorithm with:
  - 60-day cooldown
  - 1-mile minimum distance constraint
  - Seeded random for deterministic selection

**Database Schema:**
- `daily_challenges` table — One row per date with 5 photo IDs
- `daily_scores` table — Anonymous leaderboard entries
- `photos.last_daily_used_at` column — Cooldown tracking

### Frontend (React)

**New Components:**
- `src/pages/DailyChallenge.tsx` — Main daily challenge page orchestrator
- `src/components/DailyStartScreen.tsx` — Entry screen with replay prevention
- `src/components/NameCaptureModal.tsx` — Optional name submission after completion
- `src/components/DailyLeaderboard.tsx` — LinkedIn-style leaderboard display

**Modified Components:**
- `src/hooks/useGame.ts` — Added `mode` parameter to support both free-play and daily
- `src/main.tsx` — Added `/daily` and `/daily/:date` routes
- `src/components/StartScreen.tsx` — Added link to Daily Challenge
- `src/index.css` — Added styles for all new components

**Utilities:**
- `src/utils/daily-challenge-storage.ts` — localStorage management:
  - Client fingerprint generation
  - Mid-game resume state
  - Replay prevention
  - Eastern timezone date handling

---

## Pre-Deployment Checklist

### 1. Apply Database Migration

```bash
# Open Supabase Dashboard → SQL Editor
# Copy/paste contents of: supabase/schema-v6.sql
# Click Run
```

Verify:
```sql
SELECT * FROM daily_challenges LIMIT 1;
SELECT * FROM daily_scores LIMIT 1;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'photos' AND column_name = 'last_daily_used_at';
```

### 2. Build & Deploy

```bash
npm run build
vercel deploy --prod
```

### 3. Manual Testing Flow

#### Test 1: First Daily Play
1. Navigate to `/daily`
2. Click "Start Today's Challenge"
3. Complete all 5 rounds
4. Submit score with name "Test Hiker" + year 2024
5. Verify leaderboard shows your score at rank #1

#### Test 2: Replay Prevention
1. Try to navigate to `/daily` again
2. Should see "You've already completed today's challenge!"
3. Should show leaderboard instead of start button

#### Test 3: Mid-Game Resume
1. Open `/daily` in incognito window
2. Start challenge, complete 2 rounds
3. Refresh page
4. Should resume at round 3 (not restart)

#### Test 4: Anonymous Submission
1. Open `/daily` in new incognito window
2. Complete challenge
3. Click "Skip" on name capture
4. Verify leaderboard shows "Anonymous Hiker"

#### Test 5: Leaderboard Ranking
1. Open `/daily` in multiple incognito windows
2. Submit different scores (vary your guesses)
3. Verify top 5 displays correctly
4. Verify ties show shared rank (e.g., two #3s → next is #5)

#### Test 6: Historical Leaderboards
1. Navigate to `/daily/2026-06-29` (yesterday)
2. Should show that day's leaderboard if it exists
3. Should allow playing historical challenge

#### Test 7: Database Verification

```sql
-- Verify today's challenge exists
SELECT * FROM daily_challenges WHERE challenge_date = CURRENT_DATE;

-- Check 5 photos selected with 1-mile spacing
SELECT id, location_name, lat, lng FROM photos 
WHERE id = ANY((SELECT photo_ids FROM daily_challenges WHERE challenge_date = CURRENT_DATE LIMIT 1));

-- Verify cooldown updated for selected photos
SELECT id, filename, last_daily_used_at
FROM photos
WHERE last_daily_used_at IS NOT NULL
ORDER BY last_daily_used_at DESC
LIMIT 10;

-- Check leaderboard with shared ranks
SELECT 
  RANK() OVER (ORDER BY total_score DESC) as rank,
  player_name, 
  total_score,
  submitted_at
FROM daily_scores
WHERE challenge_id = (SELECT id FROM daily_challenges WHERE challenge_date = CURRENT_DATE)
ORDER BY total_score DESC;
```

### 4. Edge Cases to Test

- [ ] Pool exhaustion: What happens if <5 photos available after cooldown?
- [ ] Invalid score submission: Try submitting score > 2200
- [ ] Duplicate submission: Try submitting score twice (should get 409 Conflict)
- [ ] Round score validation: Submit with individual round score > 440
- [ ] Round score sum mismatch: Submit roundScores that don't sum to totalScore
- [ ] Date rollover: Change system time to tomorrow, verify new challenge generated
- [ ] Empty leaderboard: Historical date with no players

### 5. Performance Checks

- [ ] Photo selection completes in < 2s (1,526 photos to filter/shuffle/select)
- [ ] Leaderboard loads in < 1s
- [ ] API endpoints respond in < 500ms
- [ ] localStorage operations don't block UI

---

## Known Limitations

1. **No authentication** — Anyone can submit scores, no identity verification
2. **Client-side validation only** — Score tampering possible (mitigated by round score validation)
3. **Eastern timezone only** — Players in other timezones see challenge reset at midnight ET
4. **No social sharing** — No "share results" button (future enhancement)
5. **No historical archive UI** — Can only view historical leaderboards via direct URL

---

## Future Enhancements (Out of Scope for v1)

- [ ] Shareable result card (Wordle-style emoji grid)
- [ ] Global stats page (total players, avg scores, etc.)
- [ ] Challenge archive browser
- [ ] User profiles / authentication
- [ ] Streak tracking
- [ ] Regional leaderboards
- [ ] Weekly/monthly challenges

---

## Files Changed Summary

**New Files (17):**
- `api/daily.ts`
- `api/_lib/seeded-random.ts`
- `api/_lib/distance.ts`
- `api/_lib/select-daily-photos.ts`
- `src/pages/DailyChallenge.tsx`
- `src/components/DailyStartScreen.tsx`
- `src/components/NameCaptureModal.tsx`
- `src/components/DailyLeaderboard.tsx`
- `src/utils/daily-challenge-storage.ts`
- `supabase/schema-v6.sql`
- `supabase/README-v6-migration.md`
- `scripts/apply-daily-challenge-schema.mjs`

**Modified Files (4):**
- `src/hooks/useGame.ts` — Added daily mode support
- `src/main.tsx` — Added daily routes
- `src/components/StartScreen.tsx` — Added daily link
- `src/index.css` — Added daily styles

**Vercel Function Count:** Still at 11/12 (added `api/daily.ts`, 1 slot remaining)

---

## Deployment Notes

1. **Environment Variables:** No new env vars required (uses existing Supabase credentials)
2. **CORS:** Daily endpoint is public (no auth), CORS headers set to allow all origins
3. **Rate Limiting:** Consider adding if abuse occurs (not implemented in v1)
4. **Monitoring:** Watch for:
   - Photo selection failures (pool too small)
   - Duplicate submission attempts (client fingerprint collisions)
   - Slow leaderboard queries (add DB indexes if needed)

---

## Success Criteria

- ✅ One new API endpoint (`api/daily.ts`)
- ✅ Reuses existing game logic (no fork of `useGame.ts`)
- ✅ Doesn't modify `scoring.ts`
- ✅ Day resets at midnight Eastern
- ✅ Anonymous score submission works
- ✅ Mid-game resume via localStorage
- ✅ Replay prevention works
- ✅ Leaderboard shows shared ranks for ties
- ✅ Historical leaderboards accessible via URL
- ✅ 60-day cooldown with 1-mile spacing enforced
