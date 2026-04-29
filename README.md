# What Mile?

A GeoGuessr-style game for the Appalachian Trail. You're shown a photo taken somewhere on the AT — tap the map to guess where, then lock in your answer.

## Setup

```bash
npm install
npm run download-trail   # fetches AT route GeoJSON from OpenStreetMap (~30s, already done)
npm run dev
```

## Adding images

1. Drop a photo into `public/images/`
2. Add an entry to `src/data/images.json`:

```json
{
  "id": "unique-id",
  "filename": "your-photo.jpg",
  "locationName": "Location Name, State",
  "coordinates": [LAT, LNG],
  "description": "Optional caption shown after the round"
}
```

That's it — new entries are immediately in the pool.

## Scoring

| Tier | Distance | Points |
|------|----------|--------|
| Thru-Hiker | 0–25 mi | 1000–800 |
| LASHer | 25–100 mi | 799–500 |
| Section Hiker | 100–250 mi | 499–200 |
| Day Hiker | 250+ mi | 199–0 |

## Deploy to Vercel

```bash
vercel
```

`public/at-route.geojson` is committed as a static asset — no build-time fetch needed.

## Trail data

Route from OpenStreetMap (relation 156553) via Overpass API. Licensed under ODbL.
Refresh with: `npm run download-trail`
