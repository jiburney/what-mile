# What Mile? — Project Instructions

A GeoGuessr-style geography game for the Appalachian Trail. Players are shown a photo taken somewhere on the AT and must tap the map to guess where it was taken. Built with React 19, TypeScript, Vite, and React-Leaflet. Deployed on Vercel with a Supabase (Postgres) + Cloudflare R2 backend.

**Production:** https://what-mile.vercel.app
**Active branch:** `feat/core-redesign` (core UI/UX redesign — see status.md for current state; not yet merged to main)

---

## Before writing any code

For any new script, feature, or significant change, answer these questions before touching a file:

1. **What exactly does this do?** State it in one sentence.
2. **What are the inputs and outputs?** Be explicit.
3. **What edge cases exist in this specific project?** (e.g. HEIC files, disk space, similar-angle photos, trail towns)
4. **What decisions will the code make automatically vs. leave to the user?**
5. **Does anything need to be removed or replaced first?**
6. **Are there any constraints?** (privacy, API cost, performance, dependencies)

Do not write a prompt or start implementation until all six are answered. Shortcuts here have repeatedly caused scripts to be written and then deleted.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Routing | react-router-dom |
| Map | React-Leaflet + Leaflet |
| Styling | Plain CSS (single file, `index.css`, no framework) |
| Backend | Vercel serverless functions (`api/`) |
| Database | Supabase (Postgres) |
| Photo storage | Cloudflare R2 — two buckets: `what-mile` (public) and `what-mile-private` (pending approval) |
| Photo triage/captioning | Anthropic Haiku |
| Deploy | Vercel |

**Vercel Hobby plan constraint: 12 serverless function slots max.** Prefer action-routing into an existing `api/` file (see `enrich.ts`, `daily.ts` for the pattern) over creating a new one. Check current usage in status.md before adding a new file to `api/`.

---

## Project structure

```
src/
  App.tsx                    # Free Play route (/play) — root game component
  main.tsx                   # Router: / and /daily → DailyChallenge, /play → App, /admin/* → AdminApp
  types.ts                   # Shared TypeScript types
  index.css                  # All styles (single file, CSS variables) — see "CSS discipline" below
  components/
    GameScreen.tsx           # Shared mid-game view (photo panel, map panel) — used by both routes
    GameMap.tsx               # Leaflet map, click-to-guess, result markers, reset-view control
    GameHeader.tsx             # Persistent header (title, round pips, live score) — shared by GameScreen and SummaryCard
    RoundResult.tsx             # Per-round result card (location, stats, minimize/expand)
    EntryVeil.tsx                # Fresh-start / resume entry overlay (shown over GameScreen before a round begins)
    DailyStartScreen.tsx        # Daily Challenge "already played today" screen (View Leaderboard)
    DailyLeaderboard.tsx         # Daily Challenge leaderboard
    NameCaptureModal.tsx          # Optional name/year capture after completing a Daily Challenge
    SummaryCard.tsx                # Wraps GameSummary in the persistent GameHeader chrome
    GameSummary.tsx                 # End-of-game summary (round grid desktop / drawer rows mobile)
  pages/
    DailyChallenge.tsx          # Daily Challenge route logic (/, /daily, /daily/:date) — phase state, resume, submission
    SummaryPreview.tsx           # Dev-only route (/dev/summary), stripped from prod builds
  hooks/
    useGame.ts                    # All game state (phases, rounds, scoring) — shared by both routes
  utils/
    scoring.ts                     # calculateScore, overallTier, formatScore, MAX_SCORE, TIER_COLORS
    distance.ts                     # Haversine distance in miles
    trail-sections.ts                # Location-name parsing for summary screen (state/place display)
    daily-challenge-storage.ts       # localStorage: client fingerprint, resume state, completed rounds
  lib/
    supabase.ts                       # Browser Supabase client (used by Free Play's direct photo queries)
  admin/                                # Photo upload/triage/approval admin UI (/admin)

api/
  daily.ts                # Action-routed: get-challenge, submit-score, get-leaderboard
  enrich.ts                # Action-routed: fill-locations, count-need-location, (mile backfill planned)
  upload.ts                 # Client-side-prepped photo upload → private R2 + Supabase row
  approve-photo.ts           # Moves photo private → public R2, generates Haiku caption
  photos.ts / update-photo.ts / remove-photo.ts / skip-photo.ts / purge-skips.ts
  signed-url.ts                # Presigned R2 upload URLs
  health.ts                     # Checks R2, Supabase, Anthropic in parallel
  _lib/                          # Shared helpers (not counted against the 12-function limit)

public/
  at-route.geojson         # AT route geometry from OpenStreetMap (committed, ~3MB)

scripts/
  download-trail.mjs        # Fetches AT route from Overpass API → public/at-route.geojson
  triage-photos.mjs         # Legacy local triage pipeline (superseded by /admin upload flow — see status.md)
  ingest-photos.mjs         # Legacy ingest script (superseded by /admin upload flow)
  migrate-to-r2.mjs          # One-time migration: local images → R2
  compute-shelter-miles.mjs   # Trail-mile calibration — status.md flags known bugs, do not trust output yet
  fetch-shelters.mjs / fetch-at-data.mjs / extract-at-counties.mjs

.claude/
  settings.json               # Claude Code config
  settings.local.json          # Local permissions (gitignored)
  CLAUDE.md                     # This file — durable rules and structure
  status.md                      # Working status — current focus, in-flight work, known issues. Check this first.
  roadmap.html                    # Visual project roadmap
```

**Primary photo pipeline is now the `/admin` upload UI** (client-side prep → Vercel ingest → Haiku triage → Supabase row → manual approval). The `scripts/*triage*/*ingest*` scripts are the older local-file pipeline and are largely superseded — check status.md before assuming they're the active path.

---

## Game loop

```
start → guessing → result → (repeat 5 rounds) → summary
```

- Phase and all round state lives in `useGame.ts`, shared by both Free Play and Daily Challenge (`mode: 'free-play' | 'daily'` param).
- `ROUNDS_PER_GAME = 5`.
- Scoring tiers: **Thru-Hiker** (0–25 mi) → **LASHer** (25–100 mi) → **Section Hiker** (100–250 mi) → **Day Hiker** (250+ mi).
- **Max possible score: `MAX_SCORE` in `scoring.ts` — currently 2197.9** (this year's official AT length, symbolic). Single source of truth; tier bands and per-round max scale off it automatically. Update this one constant when the official length changes next year — do not hardcode 2200 or any other value elsewhere.
- Scores display at one decimal place (`formatScore`) everywhere — game UI, API validation, DB storage. Rounding happens only at display time, never mid-calculation (summing pre-rounded per-round scores does not equal the rounded total — see the comment in `scoring.ts`).
- Distance is straight-line (Haversine), not trail miles. Trail-mile display (`mile_nobo`/`mile_sobo`) is planned but not built — see "Do not add" below.

---

## Routing

- `/` and `/daily` and `/daily/:date` → `DailyChallenge.tsx` (Daily Challenge is the front door)
- `/play` → `App.tsx` (Free Play)
- `/admin/*` → `AdminApp` (photo upload/triage/approval)
- `/dev/summary` → dev-only, stripped from production builds (`import.meta.env.DEV` check in `main.tsx`)

Both game routes render the shared `GameScreen.tsx` — **a change to `GameScreen.tsx` affects both routes; always verify `/play` and `/daily` after touching it, not just the one you were testing.**

---

## Backend / data model

- **Photos** live in Supabase (`photos` table) with metadata (`location_name`, `lat`, `lng`, `description`, `r2_url`, `taken_at`, etc.) and in R2 for the actual image files.
- **Free Play** queries Supabase directly from the browser (`src/lib/supabase.ts`) via the `select_game_photos` RPC (random pool, 1-mile minimum distance between photos per game). This RPC is **not in any migration file** — it was created directly in the Supabase SQL editor. Inspect it via `select * from select_game_photos(5, 1.0)`, not `pg_get_functiondef` (truncates in the results grid).
- **Daily Challenge** photos are selected server-side on first request of the day (`api/daily.ts` → `api/_lib/select-daily-photos.ts`), cached in a `daily_challenges` table (date + 5 photo IDs). Same eligibility rule (random pool, `last_daily_used_at` null or 60+ days old, 1-mile minimum distance apart).
- **Daily Challenge resume**: mid-game progress is saved to `localStorage` (`daily-challenge-storage.ts`) on every round. Returning to `/daily` mid-game shows the entry veil with a "Resume Round N" CTA (not "Start round 1"), restoring prior rounds into `useGame`'s state via `startGame(resumeRounds)` rather than dropping the player straight back in silently.
- **PostgREST has a default 1000-row cap** — always use explicit limits or RPCs for game photo selection, never an unbounded query.

---

## Environment variables

All environment variables live in a `.env` file at `$WHAT_MILE_ENV` (outside the project directory, never committed to git). This path is set as a shell variable in `~/.zshrc`.

**Critical rule for all `api/` files:** Any file in `api/` that uses `process.env` must include dotenv loading at the top so it works in local development. On Vercel, `process.env` is populated automatically. Locally it needs to be loaded explicitly:

```typescript
import * as dotenv from 'dotenv'

// Load env vars from .config folder when running locally
// On Vercel, process.env is populated automatically — WHAT_MILE_ENV is not set there
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV })
}
```

This must be added to every new `api/` file that uses `process.env`. Do not skip this — omitting it causes 403 errors in local development.

**Dev server note:** `npm run dev` (Vite, port 5173) does **not** serve `/api/*` — anything touching Daily Challenge (which calls `api/daily.ts`) needs `WHAT_MILE_ENV=$HOME/.config/what-mile/.env npx vercel dev` (port 3000) instead. Free Play works on either, since it queries Supabase directly from the browser.

---

## Do not add

- **No descriptive image filenames** — R2 filenames/UUIDs only, never location-revealing.
- **No trail-mile positions or elevation graphics** anywhere in the UI. Neither is built. (`scripts/data/mile-calibration.json` has a known name-collision bug and a ~400-mile gap with no valid anchors — do not use it as a data source until that's fixed.)
- **No new dependencies** without asking first.
- **Single CSS file** (`index.css`) — use existing CSS variables, don't add new ones without good reason.
- **All game state** lives in `useGame.ts` — components are presentational. Do not change game logic — `useGame.ts`, `scoring.ts`, or any Supabase/RPC calls — unless the task is specifically about game logic.
- TypeScript strict mode is on — no `any` without a comment explaining why.

---

## Standing rules for every task

These apply automatically — no need to restate them in a prompt.

- Keep the existing React components and rewrite their layout/styling to match a request. Do not replace files wholesale unless explicitly asked to.
- Free Play (`/play`) and Daily Challenge (`/`, `/daily`) share `GameScreen.tsx` for the mid-game view and `SummaryCard.tsx` + `GameSummary.tsx` for the end screen. When a task touches any of those shared components, verify all routes still work, not just the one you were testing.
- Tests must pass (Husky runs them on pre-commit) and `npm run build` must succeed before considering a task done. Run `npm run lint` before committing.
- Do NOT open a browser or run live verification (Chrome, Playwright, or similar) to test changes. Rely on typecheck, lint, tests, and `npm run build` passing. Visual verification is done by the user afterward — running a live browser session for this is a real resource cost on an older machine and duplicates work the user is doing anyway.
- Explain your plan and wait for approval before changing any file, unless the task is explicitly small/mechanical enough that it says otherwise. Note: this is a narration/sanity-check instruction, not an enforced approval gate — if a hard stop-and-wait is actually needed for a specific task, say so explicitly and confirm the permission mode supports it, rather than assuming the phrasing alone will pause execution.
- **Preview deploys hit production Supabase.** Playing today's Daily Challenge on a branch preview submits a real score and burns the day's play. Test against a past date (e.g. `/daily/2026-08-12`) instead — `isToday` is false, so submission is skipped and it can be replayed freely. Note this also means the leaderboard/name-capture flow is intentionally *not* exercised on a past-date test; that path needs a real (or today's) date to verify.

---

## CSS discipline

Added after a specificity bug cost a full evening (August 2026): a shared
`.btn-primary:active { transform: scale(0.97); }` rule silently overrode a
component's own `transform: translateX(-50%)` centering whenever the button
was pressed, because two combined selectors (`.btn-primary:active`) beat one
(`.btn-persistent-action`) on specificity — regardless of file order. CSS
`transform` doesn't merge across separate rules; the winning declaration
replaces the whole value. The component's CSS was completely correct at
rest and only wrong while held, which made it invisible to a static read of
the file — it only showed up live, mid-interaction.

1. **If a component overrides a property that a shared/base class also sets
   conditionally** (`:hover`, `:active`, `:focus`, `:disabled`), **the
   component must explicitly override that state too.** Never assume a
   resting-state override survives into a pseudo-class state just because
   it works at rest — check or restate it explicitly, e.g.
   `.my-component:active { transform: <combined value>; }` rather than
   relying on the base class's `:active` rule to not matter.

2. **Before calling any CSS change done, grep the full stylesheet for every
   existing rule touching each class on the modified element** — not just
   the rule being added or edited, and explicitly including pseudo-class
   variants. A change that reads correctly in isolation can still be wrong
   once the rest of the cascade for that element is considered. This is a
   mechanical check, not a judgment call — do it every time, even for
   small changes.

3. **Elements positioned relative to a container (`position: absolute`
   inside a sized parent) are only as stable as that container.** If a
   panel's size can change for any reason (state, phase, viewport), don't
   assume a child anchored inside it is safe — trace whether the container
   itself can resize before trusting a position rule. Several bugs on this
   project came from exactly this: the container turned out not to be as
   fixed as it looked.

---

## Roadmap

See `.claude/roadmap.html` for the full visual layout, and `.claude/status.md` for the current working state — status.md is updated far more frequently than this file and is the better source for "what's true right now." As of this writing:

- ✅ Core redesign (photo/map panels, entry veil, round result card, final summary) — in progress on `feat/core-redesign`, not yet merged to main
- ✅ Daily Challenge — shipped, including resume
- 🔄 Bulk photo upload via `/admin` — ongoing, batch by batch
- ⬜ Merge `feat/core-redesign` to main (run `schema-v7.sql` migration immediately before deploy — see status.md)
- ⬜ Accurate trail-mile backfill ("Road A" — re-pull AT centerline from OSM, ordered)
- ⬜ Regenerate photo descriptions once mile/shelter data is populated
