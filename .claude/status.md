# What Mile? — Working Status

_Last updated: June 30, 2026_

Pick-up-where-I-left-off doc. Two tracks: **(A) getting photos in** (upload + bulk
ingest) and **(B) trail-data enrichment** (location + mile + descriptions on each photo).

---

## Where things actually are

**Deploy is green.** 10 endpoint files in `api/`, `_lib/` helpers correctly excluded from
the Vercel function count — well under the 12-function Hobby limit.

**Bulk upload is well underway** — ~1,000 photos uploaded across 15 of 56 batches.
Approved photos are live in the game and displaying real county-level `location_name`.

## Constraints (design around these)

- **Vercel Hobby plan = max 12 serverless functions.** 10 of 12 slots used. Two slots remain
  before we'd need to merge endpoints or upgrade to Pro (~$20/mo).

## Done

- **Upload pipeline solid.** GPS extraction, HEIC handling, upload progress across tab switches.
- **Deploy fixed.** Two location endpoints merged into `api/enrich.ts` (actions: `fill-locations`,
  `count-need-location`). Shared helpers moved to `api/_lib/`.
- **`api/health.ts` shipped.** Checks R2, Supabase, and Anthropic in parallel on load.
- **`useLocationFill.ts` shipped in admin.** In-admin button backfills `location_name` for all
  photos (including approved), chunked to avoid timeout.
- **Location confirmed working.** `location_name` = county + state (e.g. "Lumpkin County, GA")
  via offline point-in-polygon lookup. Displays correctly on upload.
- **Admin CSS fixed.** Grid collapse bug resolved (`align-content: start` +
  `grid-auto-rows: max-content` on `.photo-grid` and `.library-tile-grid`). Layout edge
  clipping fixed (`.admin-layout` uses `height: 100%` + `overflow-x: hidden`).
- **Trail reference file** in the repo: `scripts/data/at-reference-2023.json` (437 waypoints /
  268 shelters, 2023 Data Book, Katahdin = 2198.4).
- **Shelter name-matching fixed** → 241 shelters matched to the Data Book.
- **`compute-shelter-miles.mjs` rewritten** to interim shelter-backbone model → produces
  `shelters.json` + `data/mile-calibration.json`. ~1–2 mile accurate stopgap (see Road A).
- **Skip flow confirmed.** `purge-skips.ts` + "Purge All Skips" button in Skip tab wired and
  working. Skipped photos stay in Supabase with `status: 'skip'`; R2 file moves to `skip/`.
- **Triage script updated.** Panoramic photos now route to `review/` via the Haiku prompt
  ("wide panoramic images" added to the review category). Resume-safe via `.triage-state.json`.
- **Scoring rescaled to 2200.** `src/utils/scoring.ts` — per-round max is now 440 (was 1000),
  so a perfect 5-round game totals 2200, symbolically the full AT length (2198.4mi). Tier bands
  scaled by 0.44 from the original 0–1000 scale. Applies to both free play and Daily Challenge
  since they share `calculateScore`. No other files had hardcoded score maxes.

## In flight — current focus

### 1. Photo pipeline (ongoing)
- 15 of 56 batches uploaded (~1,000 photos). Continuing batch-by-batch.
- Triage → Finder review → upload flow is the rhythm. No changes needed to the pipeline itself.

### 2. Daily Challenge mode
- **Next feature, design locked, ready for CC prompt.**
- 5 photos/day, same set for all players, generated server-side on first request of the day
  (no cron), cached in a new `daily_challenges` Supabase table (date + 5 photo IDs).
- Selection: pure random from the eligible pool (no section weighting — explicitly rejected;
  a Katahdin photo should be as likely as an NOC photo). Eligible pool = approved photos where
  `last_daily_used_at` is null or older than 60 days. Distance qualifier: skip any candidate
  photo within 1 mile (haversine) of an already-selected photo for that day, to avoid two near-
  identical shots in one set.
- Reset at midnight Eastern.
- Replay prevention + mid-game resume via localStorage. Score submitted to `daily_scores`
  only on game completion (no partial-game submissions).
- Daily leaderboard (LinkedIn-style): your score + rank pinned at top, top 5 below, total
  players-today count. Optional name capture on completion — trail name or first name +
  last initial, plus year hiked. Skippable; score still saves either way.
- New `api/daily.ts` (action-routed like `enrich.ts`: get today's challenge, submit score,
  get leaderboard) — uses 1 of the 2 remaining Vercel function slots, leaving 1 free.
- Mockups reviewed and approved (entry card, results + name capture, leaderboard). Shareable
  result card (Wordle-style) flagged as a good idea but needs separate scoping — not in v1.

### 3. Mile — "Road A" (the accurate fix)
- **Not yet started.** Decision made: re-pull AT route from OpenStreetMap in built-in order
  (relation 156553) into `scripts/data/at-centerline-ordered.geojson`. Used only for mile math.
- **Do NOT overwrite `public/at-route.geojson`** — that's the live game map overlay.
- Mile backfill will run through `api/enrich.ts` (add a new action, no new function slot needed).

## Known issues / next pieces

- **Approved photos may have weak descriptions.** Captions are generated at approval time from
  `location_name`. Quality depends on whether location was already set when the photo was approved.
  Fix is downstream of Road A: once miles + shelter are populated, regenerate captions.
- **Location backfill status unknown.** `enrich.ts` is live but unclear if it's been run
  against the full approved pool. Run the Fill Locations button in admin to confirm/backfill.

## Target data model (locked)

- `location_name` → county + state. Shipping and working.
- `mile_nobo` + `mile_sobo` → from Road A calibration; SoBo = 2198.4 − NoBo. Not yet populated.
- `nearest_shelter` → from `shelters.json`, within a distance threshold. Not yet populated.
- `description` → Haiku caption at approval, grounded by location + mile + nearest-shelter.

## Suggested order

1. **Write + run the Daily Challenge CC prompt** — design is locked, ready to build.
2. **Continue photo batches** — keep uploading while working on features in parallel.
3. **Road A fetch script** → ordered centerline → accurate miles → backfill via `enrich.ts`.
4. **Regenerate descriptions** for approved photos once miles + shelter are populated.

## Working style

- **Keep CC prompts problem/outcome-focused.** State the problem, desired end-result, and hard
  constraints (don't break X, must pass build, preserve behavior). Let CC choose the how.
- **Re-read files immediately before editing.** `filesystem:edit_file` requires exact `oldText`
  match — stale reads cause failed edits.
- **Update this file** whenever plans change, something lands, or a decision is made.

## Watch out

- **Two Vercel function slots remain.** Daily Challenge will likely need one. Plan accordingly.
- **`admin.css` edited outside CC** — re-read before any CSS edits to avoid clobbering changes.
