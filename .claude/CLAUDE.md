# What Mile? — Project Instructions

A GeoGuessr-style geography game for the Appalachian Trail. Players are shown a photo taken somewhere on the AT and must tap the map to guess where it was taken. Built with React 19, TypeScript, Vite, and React-Leaflet. Deployed on Vercel.

**Production:** https://what-mile.vercel.app

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
| Map | React-Leaflet + Leaflet |
| Styling | Plain CSS (no framework) |
| Deploy | Vercel |
| Data storage | Static JSON + Vercel KV (planned) |
| Analytics | Vercel Analytics (planned) |

---

## Project structure

```
src/
  App.tsx               # Root component, game phase routing
  types.ts              # Shared TypeScript types
  index.css             # All styles (single file, CSS variables)
  components/
    StartScreen.tsx     # Title/start screen
    GameMap.tsx         # Leaflet map, click-to-guess, result markers
    RoundResult.tsx     # Per-round result panel (distance, tier, score)
    GameSummary.tsx     # End-of-game summary screen
  hooks/
    useGame.ts          # All game state (phases, rounds, scoring)
  utils/
    scoring.ts          # Score calculation + tier thresholds + TIER_COLORS
    distance.ts         # Haversine distance in miles
  data/
    images.json         # Photo pool — source of truth for all game images
    ingested.json       # Tracks source filenames already processed by ingest script

public/
  images/               # Photo files — filenames are UUIDs (not descriptive names)
  at-route.geojson      # AT route geometry from OpenStreetMap (committed, ~3MB)

scripts/
  download-trail.mjs    # Fetches AT route from Overpass API → public/at-route.geojson
  ingest-photos.mjs     # Ingests approved photos into the game
  triage-photos.mjs     # Pre-ingest triage: blur/screenshot → face detection → Haiku
  anonymize-images.mjs  # One-time migration: renames files to UUIDs (already run)

.claude/
  settings.json         # Claude Code config (model: claude-sonnet-4-5)
  settings.local.json   # Local permissions (gitignored)
  CLAUDE.md             # This file
  roadmap.html          # Visual project roadmap
```

---

## Game loop

```
start → guessing → result → (repeat N rounds) → summary
```

- Phase and all round state lives in `useGame.ts`
- `ROUNDS_PER_GAME = 5` is defined at the top of `useGame.ts`
- Scoring tiers: **Thru-Hiker** (0–25 mi) → **LASHer** (25–100 mi) → **Section Hiker** (100–250 mi) → **Day Hiker** (250+ mi)
- Max possible score: 5,000 (1,000 per round)
- Distance is straight-line (Haversine), not trail miles

---

## Image data

All game images are defined in `src/data/images.json`. Each entry:

```json
{
  "id": "mcafee-knob",           // kebab-case, human-readable, used as React key
  "filename": "uuid-here.jpg",   // UUID filename — never descriptive (would give away location)
  "locationName": "McAfee Knob, VA",
  "coordinates": [37.3933, -80.0988],
  "description": "Optional caption shown after the round"
}
```

**Important:** `filename` must always be a UUID. Never use descriptive names — they're visible in the browser network tab and give away the answer.

---

## Photo pipeline

Photos go through three steps before entering the game. Each step is a separate manual command — nothing auto-feeds into the next.

```
triage-photos.mjs  →  ready/ review/ skip/  →  manual review in Finder  →  ingest-photos.mjs
```

### 1. Triage
```bash
node scripts/triage-photos.mjs --folder ~/path/to/photos/
```

Three-stage pipeline:
- **Stage 1** — Local heuristics: blur detection, screenshot detection (no API)
- **Stage 2** — Face detection via `@vladmandic/face-api` + `@tensorflow/tfjs-node` (local ML, no API)
- **Stage 3** — Claude Haiku: classifies trail content quality (API)

Sorts into `ready/`, `review/`, `skip/` subfolders. Resumable — state saved to `.triage-state.json`.

"AT experience" is broad: trail, shelters, viewpoints, trail towns, hostels, road crossings, resupply stops. Photos of people go to `review/` not `skip/`.

### 2. Manual review
Browse `ready/`, `review/`, `skip/` in Finder. Move keepers from `review/` into `ready/`. Spot check `skip/` for false positives.

### 3. Ingest
```bash
# Basic ingest
node scripts/ingest-photos.mjs --folder ~/path/to/ready/

# With Claude-generated descriptions
node scripts/ingest-photos.mjs --folder ~/path/to/ready/ --descriptions

# Generate missing descriptions for already-ingested photos
node scripts/ingest-photos.mjs --redescribe
```

The ingest script:
1. Reads GPS coords from EXIF (`exifr`)
2. Reverse-geocodes to a location name (Nominatim, 1 req/sec rate limit respected)
3. Optionally generates a description via Claude vision (`--descriptions`)
4. Falls back to Claude vision for location + coords if no GPS data
5. Assigns a UUID filename, copies to `public/images/`
6. Appends entry to `src/data/images.json`
7. Tracks source filenames in `src/data/ingested.json` to prevent duplicates

---

## Trail data

`public/at-route.geojson` is committed to the repo — no build-time fetch needed. Refresh with:

```bash
node scripts/download-trail.mjs
```

Source: OpenStreetMap relation 156553 via Overpass API. Licensed ODbL.

---

## Local dev

```bash
npm install
npm run dev
```

## Deploy

```bash
vercel
```

---

## Conventions

- **No descriptive image filenames** in `public/images/` — UUIDs only
- **`id` field** in `images.json` stays kebab-case (internal use only, never exposed to browser)
- **Single CSS file** (`index.css`) — use existing CSS variables, don't add new ones without good reason
- **All game state** lives in `useGame.ts` — components are presentational
- **No backend yet** — keep things static/client-side until Vercel KV is introduced
- TypeScript strict mode is on — no `any` without a comment explaining why
- Run `npm run lint` before committing

---

## Roadmap

See `.claude/roadmap.html` for the full visual roadmap. Current priorities:

1. ✅ Anonymize image filenames (UUIDs)
2. 🔄 Photo triage pipeline (triage-photos.mjs)
3. ⬜ Daily Challenge mode
4. ⬜ Analytics + Vercel KV for image play tracking
