/**
 * Downloads the Appalachian Trail route from OpenStreetMap via the Overpass API
 * and saves it as GeoJSON to public/at-route.geojson.
 *
 * Usage:  node scripts/download-trail.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'public', 'at-route.geojson');

// Overpass query: fetch all ways of the AT master relation (OSM ID 156553).
// The AT is a super-relation containing state-section sub-relations,
// so we recurse: master → section relations → ways → nodes.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const QUERY = `
[out:json][timeout:300];
relation(156553);
rel(r);
way(r);
(._;>;);
out body;
`;

async function fetchOverpass() {
  console.log('Fetching AT route from Overpass API (this may take ~30s)...');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  return res.json();
}

function osmToGeoJSON(data) {
  // Build node lookup: id -> [lon, lat]
  const nodes = {};
  for (const el of data.elements) {
    if (el.type === 'node') nodes[el.id] = [el.lon, el.lat];
  }

  // Build each way as a LineString coordinate array
  const lines = [];
  for (const el of data.elements) {
    if (el.type !== 'way') continue;
    const coords = el.nodes.map((id) => nodes[id]).filter(Boolean);
    if (coords.length >= 2) lines.push(coords);
  }

  if (lines.length === 0) throw new Error('No way geometries found in Overpass response');

  console.log(`Converting ${lines.length} way segments to GeoJSON...`);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Appalachian National Scenic Trail',
          source: 'OpenStreetMap contributors, Overpass API',
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: lines,
        },
      },
    ],
  };
}

async function main() {
  try {
    mkdirSync(join(__dirname, '..', 'public'), { recursive: true });
    const data = await fetchOverpass();
    const geojson = osmToGeoJSON(data);
    writeFileSync(OUTPUT, JSON.stringify(geojson));
    const kb = Math.round(JSON.stringify(geojson).length / 1024);
    console.log(`✓ Saved ${kb} KB → public/at-route.geojson`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
