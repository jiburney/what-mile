# What Mile? — Working Status

_Last updated: June 19, 2026_

Pick-up-where-I-left-off doc. Two tracks: **(A) getting photos in** (upload + bulk
ingest) and **(B) trail-data enrichment** (location + mile + descriptions on each photo).

---

## Where things actually are

Bulk upload is **underway** — multiple batches uploaded, and a number of photos are
**already approved and live in the game**. Those approved photos currently have
`location_name = "Unknown"` and missing/weak descriptions (see Known issues). Enrichment
has to backfill them, not just handle new uploads.

**Right now the blocker is the Vercel deploy** (see Constraints): it's failing on the
12-function limit, which also means the latest build (incl. a CSS fix) isn't live.

## Constraints (design around these)

- **Vercel Hobby plan = max 12 serverless functions.** Every top-level `.ts` file in `api/`
  counts as one — including shared helper modules that aren't even endpoints. We hit 13 and the
  deploy broke. Keep an eye on the count when adding endpoints. (Upgrading to Pro, ~$20/mo,
  removes this and the function-timeout caps — fallback option, not taken yet.)

## Done

- **Upload pipeline solid.** GPS extraction works; HEIC no longer hangs a batch; upload progress
  survives switching admin tabs. Earlier "skip everything / no GPS" was a stale bundle, not a bug.
- **Trail reference file** in the repo: `scripts/data/at-reference-2023.json` (437 waypoints /
  268 shelters, 2023 Data Book, Katahdin = 2198.4).
- **Shelter name-matching fixed** → **241 shelters matched** to the Data Book.
- **`compute-shelter-miles.mjs` rewritten to an interim shelter-backbone model** → produces
  `shelters.json` + `data/mile-calibration.json`. Works, but ~1–2 mile-accurate **stopgap**
  (see Road A for the accurate fix).
- **Location feature mostly built by CC** — `api/fill-locations.ts`, `api/photos-need-location.ts`,
  `api/lib/geocode-county.ts` (offline county lookup), plus `src/admin/useLocationFill.ts`. It just
  hasn't shipped because of the deploy/function-count issue.
- **CSS "thin pills" mystery solved** — the admin photo-grid CSS on disk is **correct** (4:3 tiles,
  `object-fit: contain`, normal grid). The pills were a **stale build** from the failed deploy.
  Once the deploy goes green, the grid renders right. No CSS work needed.

## In flight — current focus

### 1. Fix the deploy (unblocks everything)
- Get `api/` back under 12 functions **without losing features**. Approach is CC's call, but the
  shape: move shared non-endpoint helpers (supabase-admin, geocode-county, maybe trail-sections)
  out of the counted path, and **merge the two location endpoints into one** (`api/enrich.ts`:
  GET = what needs filling, POST = fill a chunk).
- **The mile-enrichment step will live in that SAME `api/enrich.ts`** — so mile adds no new
  function later. The consolidation is the architecture we want, not just a workaround.
- **Problem-focused CC prompt written this session — not yet run.**

### 2. Location enrich (ships with the deploy fix)
- `location_name` = **county + state** (e.g. "Lumpkin County, GA"), from **offline US county data**
  (point-in-polygon), via an in-admin button that processes every photo needing it **across all
  statuses (incl. approved)**, chunked to dodge the function timeout.
- Don't overload `location_name` — mile + nearest-shelter are separate fields.
- After it ships: run it once to backfill the existing/approved "Unknown" photos.

### 3. Mile — "Road A" (the accurate fix)
- Calibration thrashed because the trail data is **unordered fragments** and ordering them kept
  failing. **Decision: re-pull the AT route from OpenStreetMap _in its built-in order_**
  (relation 156553) into a **new file** (e.g. `scripts/data/at-centerline-ordered.geojson`) used
  only for mile math.
- **Do NOT overwrite `public/at-route.geojson`** — that's the live game's map overlay. Two files,
  two jobs.
- Then point `compute-shelter-miles.mjs` + the photo-mile backfill at the ordered file → accurate
  miles. Mile backfill runs through the same `api/enrich.ts`. **Road A fetch script not yet written.**

## Known issues / next pieces

- **Approved photos have weak/missing descriptions** (caption is built from `location_name`, which
  was "Unknown"). Fix is **downstream of location**: once location is backfilled, regenerate
  captions for approved photos (later also fed mile + nearest-shelter).

## Target data model (locked)

- `location_name` → county + state. Independent of calibration; shipping now.
- `mile_nobo` + `mile_sobo` → from Road A calibration; SoBo = 2198.4 − NoBo. Separate fields.
- `nearest_shelter` → from `shelters.json`, within a distance threshold.
- `description` → Haiku caption at approval, grounded by location + mile + nearest-shelter.

## Suggested order

1. **Land the deploy fix** (functions back under 12) → deploy goes green → CSS fix + location ship.
2. **Run Location Enrich** → fills location on all photos incl. approved.
3. **Road A fetch script** → ordered centerline → re-run mile calc → backfill photo miles (via `enrich`).
4. **Regenerate descriptions** for approved photos (now grounded on real location).
5. Continue bulk upload (~56 batches total).

## Working style

- **Keep CC prompts problem/outcome-focused.** State the problem, the desired end-result, and the
  hard constraints (don't break X, must pass a build, preserve behavior) — then let CC choose the
  *how*. Don't over-prescribe the implementation.

## Watch out

- **Actively editing the admin gallery/lightbox in Cowork/Code.** Keep new admin UI (e.g. the
  location button) **isolated**; don't restructure gallery components, to avoid collisions.

## Housekeeping

- Commit: `scripts/data/at-reference-2023.json`, the rewritten `compute-shelter-miles.mjs`,
  updated `.claude/roadmap.html` + `.claude/status.md`.
- Confirm the earlier `public/at-route.geojson` staged change and untracked `supabase/schema-v4.sql`
  are intentional.
