# What Mile? — Working Status

_Last updated: July 26, 2026_

Pick-up-where-I-left-off doc. Three tracks: **(A) getting photos in** (upload + bulk
ingest), **(B) trail-data enrichment** (location + mile + descriptions on each photo),
and **(C) the core UI redesign** — active work, branch `feat/core-redesign`.

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
- **`compute-shelter-miles.mjs` rewritten** to interim shelter-backbone model → intended to
  produce `shelters.json` + `data/mile-calibration.json`. **⚠️ The v2 script appears never to
  have been run** — the on-disk `mile-calibration.json` is dated June 14 and predates it.
  **That file is broken. Do not use it.** See "Known issues" below.
- **Skip flow confirmed.** `purge-skips.ts` + "Purge All Skips" button in Skip tab wired and
  working. Skipped photos stay in Supabase with `status: 'skip'`; R2 file moves to `skip/`.
- **Triage script updated.** Panoramic photos now route to `review/` via the Haiku prompt
  ("wide panoramic images" added to the review category). Resume-safe via `.triage-state.json`.
- **Scoring rescaled to 2200.** `src/utils/scoring.ts` — per-round max is now 440 (was 1000),
  so a perfect 5-round game totals 2200, symbolically the full AT length (2198.4mi). Tier bands
  scaled by 0.44 from the original 0–1000 scale. Applies to both free play and Daily Challenge
  since they share `calculateScore`. No other files had hardcoded score maxes.

## In flight — current focus

### 0. Core UI redesign — branch `feat/core-redesign` (ACTIVE)

Not yet merged to main. Production is unaffected.

**Routes:** `/` → `src/App.tsx` (Free Play), `/daily` → `src/pages/DailyChallenge.tsx`.
Both render the shared `src/components/GameScreen.tsx`. **Any game-screen change affects
both — always verify both.**

**Landed:** design tokens; game screen rebuilt as two panels (photo + map); `GameScreen`
extracted and shared; entry veil for both modes (auto-start, StrictMode-guarded);
dark page background; map `maxBounds` + dynamic `minZoom`; photo zoom/pan moved into the
photo panel and `PhotoFullscreen.tsx` deleted.

**Non-negotiable interaction rules.** Each of these cost a rollback to learn:

- Within a round, **only the player resizes the map**, via the expand control. Not pin
  placement, not confirming, not panning.
- Round advance is the one exception: resets to minimized + full-trail view.
- Expand/collapse **preserves** map center and zoom. Never re-fit, never re-center on the pin.
- Map viewport must **never** derive from the photo's real coordinates — that leaks the answer.
- Photo resets to 1× on round advance, but is **preserved** across panel resize.
- Clamp pan offset after every zoom, pan, **and panel resize** — not just on drag.

**Still stale / outstanding on this branch:**
- Final summary being actively restyled now (header personality copy, big score, mode-aware
  CTA, flexible/responsive text sizing pass) — see prompt below
- Collapsed map preview is still a hardcoded fake SVG squiggle
- Nudge controls and reset-to-full-trail not built

**Roadmap idea — not yet built:** if a player returns to `/daily` after already completing
today's challenge, consider landing them on the full `GameSummary` (round-by-round card grid)
instead of `DailyStartScreen`'s already-played branch, which currently only shows total/tier/
accuracy. Not a small change — `GameSummary` is currently built from live `state.rounds` during
an active session; showing it after a fresh page load would mean reconstructing that view from
the saved `finalScore` in localStorage instead. Worth scoping properly when picked up, not a
quick prop change.

**Explicitly out of scope** (drawn in the Claude Design mockups, not built): trail-mile
readouts, elevation graphics, daily countdown, geocoded place labels ("Near Bear Mountain,
NY"). "Review rounds" as a separate button/feature has been dropped for good — the summary
screen's card grid (desktop) and expandable drawers (mobile) already do that job.

**Share result — decided direction, not yet built.** A simple visual card (score, tier, one
colored square per round like Wordle — tier-colored via `TIER_COLORS`, no photos or location
names on the card itself, so it can't spoil the answer for whoever receives it). The shared
link must send the recipient to play their OWN fresh daily challenge, never the sharer's —
this already works for free, since `/daily` gates on the recipient's own `canPlayToday()` in
their own localStorage, not anything tied to the link. Two ways to build the card itself, not
yet chosen between:
  - **Client-side canvas** — draws in-browser, `navigator.share` with an image file where
    supported, clipboard/download fallback elsewhere. No new dependency, no new server function.
  - **Server-rendered OG image** (`@vercel/og` or similar) — a Vercel Edge Function generates
    the card from query params. Bigger payoff: the *link itself* shows a rich preview when
    pasted anywhere (iMessage, Discord, Twitter), not just an attachment someone has to
    remember to include — meaningfully better for the stated goal of this spreading and
    crediting back to James. Costs a new dependency and a Vercel function slot (2 of 12
    remain — see "Watch out" below).

### 1. Photo pipeline (ongoing)
- 15 of 56 batches uploaded (~1,000 photos). Continuing batch-by-batch.
- Triage → Finder review → upload flow is the rhythm. No changes needed to the pipeline itself.

### 2. Daily Challenge mode — ✅ SHIPPED
- Live at `/daily`. Everything below describes what was built, kept for reference.
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

- **⚠️ `scripts/data/mile-calibration.json` is broken — do not use it.** 200 anchors, dated
  June 14. It contains a shelter name-collision: `Cove Mountain Shelter, PA` maps
  `raw_gis_mile 756.1` → `at_mile 1145.9`. There are two Cove Mountain Shelters — one in VA
  near mile 756, one in PA at 1145.9 — and the matcher paired the VA position with the PA
  mile. In a piecewise-linear interpolation this compresses everything between raw mile 756
  and 1150 into roughly eight reported miles, so northern Virginia, Shenandoah, Harpers
  Ferry, and Maryland all return nonsense. There are also **no valid anchors at all** between
  Wilson Creek (VA, 742) and Clarks Ferry (PA, 1154) — ~400 miles with nothing to interpolate
  against.

  It fails **silently and plausibly**: GA, NC, TN, and ME all look correct, which makes it
  easy to trust. Two cheap fixes when this is picked up: (1) match shelters on **name + state**,
  not name alone; (2) assert `at_mile` and `raw_gis_mile` increase monotonically together and
  that no adjacent anchor pair has a wildly different slope than its neighbours — that
  assertion catches the Cove Mountain case instantly.

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

1. **Finish `feat/core-redesign`** — entry screen polish, round result polish, final summary
   restyle. Small single-purpose CC prompts; large multi-concern prompts caused a rollback.
2. **Merge to main and deploy.** Test both `/` and `/daily` on a branch preview first.
3. **Continue photo batches** — keep uploading while working on features in parallel.
4. **Road A fetch script** → ordered centerline → accurate miles → backfill via `enrich.ts`.
   Fix the `mile-calibration.json` name-collision bug as part of this.
5. **Regenerate descriptions** for approved photos once miles + shelter are populated.

## Working style

- **Keep CC prompts problem/outcome-focused.** State the problem, desired end-result, and hard
  constraints (don't break X, must pass build, preserve behavior). Let CC choose the how.
- **One concern per prompt.** A prompt that bundled layout, sizing rules, viewport
  preservation, round reset, four bug fixes, and new controls produced an unusable result that
  had to be reverted — too much surface to review in one pass. Smaller prompts, separate
  commits, verify between each.
- **Prose can't carry interaction.** For anything about how a gesture or transition *feels*,
  prototype it before writing a prompt. Several rounds were lost to specs that read correctly
  and built the wrong experience.
- **Re-read files immediately before editing.** `filesystem:edit_file` requires exact `oldText`
  match — stale reads cause failed edits.
- **Update this file** whenever plans change, something lands, or a decision is made.

## Watch out

- **Vercel function slots.** `api/daily.ts` shipped, so budget accordingly before adding
  endpoints. Prefer action-routing into an existing file (`enrich.ts`, `daily.ts`) over a
  new function.
- **`admin.css` edited outside CC** — re-read before any CSS edits to avoid clobbering changes.

### Environment gotchas (all of these cost real debugging time)

- **`npm run dev` (port 5173) does NOT serve `/api/*`.** Vite alone can't run the serverless
  functions, so `/daily` hangs forever on "Loading today's challenge…" with only a
  `console.error`. Use `WHAT_MILE_ENV=$HOME/.config/what-mile/.env npx vercel dev` (port 3000)
  for anything touching Daily. Free Play works on either, since it queries Supabase directly
  from the browser via the `VITE_` vars.
- **Leaflet caches container size at init.** If the container is measured at zero or the wrong
  size, you get tiles in a band with blank space around them, and any `getBoundsZoom()`
  derived from it is garbage — this is what produced a whole-world map view. Always
  `invalidateSize()` before computing zoom, never compute from a zero-size container, and
  keep the `minZoom` floor of 4 as a guard.
- **`main.tsx` uses `<StrictMode>`** — effects run twice in dev. Guard anything that
  auto-starts or fetches on mount.
- **Catastrophic-looking layout breakage is usually a stale Vite bundle**, not a real bug —
  old JS served against new CSS. `rm -rf node_modules/.vite`, restart, hard reload
  (Cmd+Shift+R) before debugging anything else.
- **Preview deploys hit production Supabase.** Playing today's daily on a branch preview
  submits a real score and burns the day's play. Use a past date (`/daily/2026-07-20`) —
  `isToday` is false, so submission is skipped and it can be replayed freely.
