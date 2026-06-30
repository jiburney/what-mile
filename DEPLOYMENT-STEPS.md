# Daily Challenge Deployment Steps

## ✅ Implementation Complete

All code has been written and the build passes successfully. Ready for database migration and deployment.

---

## Step 1: Apply Database Migration

**CRITICAL: Do this first, before deploying the new code.**

### Via Supabase Dashboard (Recommended)

1. Open https://supabase.com/dashboard
2. Select your What Mile project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open `/Users/jamesburney/dev/projects/what-mile/supabase/schema-v6.sql` in your editor
6. Copy the entire contents
7. Paste into the Supabase SQL Editor
8. Click **Run** (bottom right)
9. Wait for "Success. No rows returned" message

### Verify Migration

Run this query in the SQL Editor:

```sql
-- Check all 3 schema changes applied
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'daily_challenges') as challenges_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'daily_scores') as scores_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'photos' AND column_name = 'last_daily_used_at') as photos_column;
```

Expected result: `{ challenges_table: 1, scores_table: 1, photos_column: 1 }`

---

## Step 2: Deploy to Vercel

```bash
cd /Users/jamesburney/dev/projects/what-mile

# Build locally to verify one more time
npm run build

# Deploy to production
vercel deploy --prod
```

The build output should show:
- ✅ `dist/index.html` created
- ✅ `dist/assets/index-*.css` created
- ✅ `dist/assets/index-*.js` created
- ✅ No TypeScript errors

---

## Step 3: Smoke Test

Once deployed, test the core flow:

### Test 1: Play Daily Challenge

1. Navigate to `https://what-mile.vercel.app/daily`
2. Click "Start Today's Challenge"
3. Complete all 5 rounds
4. Submit score with name and year
5. Verify leaderboard appears

### Test 2: Replay Prevention

1. Refresh `/daily`
2. Should see "You've already completed today's challenge!"
3. Should show leaderboard, not start button

### Test 3: Check API Logs

In Vercel Dashboard:
1. Go to your deployment
2. Click **Functions** tab
3. Click on `api/daily`
4. Check for any errors in recent invocations

---

## Step 4: Database Verification

In Supabase SQL Editor:

```sql
-- Today's challenge should exist
SELECT 
  challenge_date, 
  array_length(photo_ids, 1) as photo_count,
  created_at
FROM daily_challenges 
WHERE challenge_date = CURRENT_DATE;

-- Should return exactly 5 photos
-- Verify they're all different and have 1+ mile spacing
SELECT 
  p1.id as photo1_id,
  p1.location_name as location1,
  p2.id as photo2_id,
  p2.location_name as location2,
  ROUND(
    3958.8 * 2 * ASIN(
      SQRT(
        POWER(SIN((p2.lat - p1.lat) * PI() / 360), 2) +
        COS(p1.lat * PI() / 180) * COS(p2.lat * PI() / 180) *
        POWER(SIN((p2.lng - p1.lng) * PI() / 360), 2)
      )
    )
  )::numeric as distance_miles
FROM photos p1
CROSS JOIN photos p2
WHERE p1.id = ANY((SELECT photo_ids FROM daily_challenges WHERE challenge_date = CURRENT_DATE LIMIT 1))
  AND p2.id = ANY((SELECT photo_ids FROM daily_challenges WHERE challenge_date = CURRENT_DATE LIMIT 1))
  AND p1.id < p2.id
ORDER BY distance_miles;

-- All distances should be >= 1.0 miles

-- Check leaderboard entries
SELECT 
  player_name,
  total_score,
  RANK() OVER (ORDER BY total_score DESC) as rank,
  submitted_at
FROM daily_scores
WHERE challenge_id = (SELECT id FROM daily_challenges WHERE challenge_date = CURRENT_DATE)
ORDER BY total_score DESC;
```

---

## Step 5: Monitor for Issues

### First 24 Hours

Watch for:
- **Slow photo selection** — Should complete in < 2 seconds
- **Duplicate submission errors** — Indicates fingerprint collision (very rare)
- **Challenge creation failures** — Could indicate pool exhaustion or distance constraint too tight
- **API timeouts** — Check Vercel function logs

### Potential Issues & Fixes

**Issue:** "Insufficient photos for daily challenge"
- **Cause:** < 5 photos available after 60-day cooldown + 1-mile constraint
- **Fix:** Reduce cooldown in `api/_lib/select-daily-photos.ts` (line 27)

**Issue:** Client fingerprint collisions
- **Cause:** Multiple users from same browser/device
- **Fix:** Add device info to fingerprint generation

**Issue:** Leaderboard slow to load
- **Cause:** Large number of scores (>1000)
- **Fix:** Add pagination or limit to top 100

---

## Rollback Plan

If critical issues arise:

### Option 1: Disable Daily Challenge

1. Revert `src/main.tsx` to remove `/daily` routes
2. Redeploy with `vercel deploy --prod`
3. Database tables remain but feature is inaccessible

### Option 2: Full Rollback

```bash
# Revert all changes
git revert <commit-hash>
vercel deploy --prod

# Optional: Drop database tables
# (Run this in Supabase SQL Editor)
DROP TABLE IF EXISTS daily_scores CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
ALTER TABLE photos DROP COLUMN IF EXISTS last_daily_used_at;
```

---

## Success Metrics

After 1 week, check:
- **Daily active users** — How many unique fingerprints per day?
- **Completion rate** — % who finish all 5 rounds
- **Score distribution** — Is difficulty balanced?
- **Repeat play attempts** — How many try to replay same day? (should be blocked)

---

## Next Steps (Optional Enhancements)

- [ ] Add shareable result card (Wordle-style)
- [ ] Create challenge archive page
- [ ] Add global stats page
- [ ] Implement streak tracking
- [ ] Add admin panel for manual challenge override

---

## Files Summary

**New Files (12):**
- `api/daily.ts` (main endpoint)
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
- `src/hooks/useGame.ts`
- `src/main.tsx`
- `src/components/StartScreen.tsx`
- `src/index.css`

**Vercel Function Count:** 11/12 (1 slot remaining)

---

## Support

If issues arise during deployment:
1. Check Vercel function logs
2. Check Supabase logs (Database → Logs)
3. Check browser console for frontend errors
4. Review `DAILY-CHALLENGE-IMPLEMENTATION.md` for detailed testing steps
