#!/usr/bin/env node
/**
 * fetch-shelters.mjs
 *
 * Standalone script to fetch Appalachian Trail shelters from OpenStreetMap
 * and generate a reviewable shelters.json file.
 *
 * Dependencies: npm install --save-dev @turf/turf
 *
 * Usage: node scripts/fetch-shelters.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tunable threshold: maximum distance from trail centerline (meters)
const OFFTRAIL_THRESHOLD_M = 800;

// Overpass API endpoint
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Load the AT route as a MultiLineString (use segments directly for distance calculations)
 */
function loadTrail() {
  console.log('Loading AT route from public/at-route.geojson...');

  const geojsonPath = path.join(__dirname, '../public/at-route.geojson');
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

  const feature = geojson.features[0];
  if (feature.geometry.type !== 'MultiLineString') {
    throw new Error(`Expected MultiLineString, got ${feature.geometry.type}`);
  }

  const segments = feature.geometry.coordinates;
  console.log(`Found ${segments.length} segments`);

  // Create MultiLineString feature for distance calculations
  const multiLine = turf.multiLineString(segments);

  // Compute total length by summing all segment lengths
  let totalLengthMiles = 0;
  for (const coords of segments) {
    const line = turf.lineString(coords);
    totalLengthMiles += turf.length(line, { units: 'miles' });
  }

  console.log(`✓ Total trail length: ${totalLengthMiles.toFixed(1)} miles`);

  // Sanity check
  if (totalLengthMiles < 2150 || totalLengthMiles > 2250) {
    console.warn(`⚠ Trail length ${totalLengthMiles.toFixed(1)} mi is outside expected range (2,190–2,200). GeoJSON may be incomplete.`);
  }

  // Convert to FeatureCollection of individual segments for distance checking
  const segmentFeatures = segments.map(coords => turf.lineString(coords));

  return { segmentFeatures, totalLengthMiles };
}

/**
 * Query Overpass API for AT shelters
 */
async function fetchSheltersFromOverpass() {
  console.log('\nQuerying Overpass API for shelters...');

  // Bounding box: [south, west, north, east]
  const bbox = '34.0,-85.0,46.5,-67.5';

  const query = `
    [out:json][timeout:60];
    (
      node["tourism"="wilderness_hut"](${bbox});
      node["amenity"="shelter"]["shelter_type"~"lean_to|basic_hut|weather_shelter"](${bbox});
      way["tourism"="wilderness_hut"](${bbox});
      way["amenity"="shelter"]["shelter_type"~"lean_to|basic_hut|weather_shelter"](${bbox});
    );
    out center;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'what-mile-shelter-fetch/1.0 (AT game data generator)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.elements || data.elements.length === 0) {
    throw new Error('Overpass API returned no results. Check query or try again later.');
  }

  console.log(`✓ Found ${data.elements.length} shelter features`);

  // Convert to simple array of {name, lat, lng}
  const shelters = data.elements.map(el => {
    // For ways, use center coords; for nodes, use direct coords
    const lat = el.lat || el.center?.lat;
    const lng = el.lon || el.center?.lon;
    const name = el.tags?.name || null;

    return { name, lat, lng };
  }).filter(s => s.lat && s.lng); // Drop any without coordinates

  return shelters;
}

/**
 * Filter shelters by distance to trail, compute miles, deduplicate
 */
function processShelters(shelters, segmentFeatures, totalLengthMiles) {
  console.log(`\nProcessing shelters (threshold: ${OFFTRAIL_THRESHOLD_M}m from trail)...`);

  const results = [];

  for (const shelter of shelters) {
    const point = turf.point([shelter.lng, shelter.lat]);

    // Find the closest segment and distance to trail
    let minDistanceM = Infinity;
    let closestSegment = null;

    for (const segment of segmentFeatures) {
      const distanceM = turf.pointToLineDistance(point, segment, { units: 'meters' });
      if (distanceM < minDistanceM) {
        minDistanceM = distanceM;
        closestSegment = segment;
      }
    }

    if (minDistanceM > OFFTRAIL_THRESHOLD_M) {
      continue; // Too far from trail
    }

    // Project onto the closest segment
    const snapped = turf.nearestPointOnLine(closestSegment, point, { units: 'miles' });

    // For nobo_mile, we'll use the latitude as a proxy (south to north ordering)
    // This is imperfect but works for rough positioning
    // More accurate would require stitching, but for shelter discovery this is adequate
    const nobo_mile = (shelter.lat - 34.5672) * 65; // Rough conversion: ~2190 mi / (45.9 - 34.6) degrees
    const sobo_mile = totalLengthMiles - nobo_mile;

    results.push({
      name: shelter.name,
      lat: shelter.lat,
      lng: shelter.lng,
      nobo_mile: Math.round(Math.max(0, nobo_mile) * 10) / 10,
      sobo_mile: Math.round(Math.max(0, sobo_mile) * 10) / 10,
      offtrail_m: Math.round(minDistanceM),
    });
  }

  console.log(`✓ Kept ${results.length} shelters within ${OFFTRAIL_THRESHOLD_M}m of trail`);

  // Deduplicate: same name + near-identical location
  const deduplicated = [];
  const seen = new Set();

  for (const shelter of results) {
    const key = `${shelter.name || 'UNNAMED'}_${shelter.lat.toFixed(3)}_${shelter.lng.toFixed(3)}`;
    if (!seen.has(key)) {
      deduplicated.push(shelter);
      seen.add(key);
    }
  }

  if (deduplicated.length < results.length) {
    console.log(`✓ Removed ${results.length - deduplicated.length} duplicates`);
  }

  // Sort by nobo_mile (Springer → Katahdin)
  deduplicated.sort((a, b) => a.nobo_mile - b.nobo_mile);

  return deduplicated;
}

/**
 * Main execution
 */
async function main() {
  try {
    // 1. Load trail segments
    const { segmentFeatures, totalLengthMiles } = loadTrail();

    // 2. Fetch shelters from Overpass
    const rawShelters = await fetchSheltersFromOverpass();

    // 3. Filter, compute miles, deduplicate
    const shelters = processShelters(rawShelters, segmentFeatures, totalLengthMiles);

    // 4. Output to JSON
    const outputPath = path.join(__dirname, 'shelters.json');
    fs.writeFileSync(outputPath, JSON.stringify(shelters, null, 2));
    console.log(`\n✓ Wrote ${shelters.length} shelters to ${outputPath}`);

    // 5. Summary
    const noName = shelters.filter(s => s.name === null).length;
    const mileRange = shelters.length > 0
      ? `${shelters[0].nobo_mile}–${shelters[shelters.length - 1].nobo_mile} mi`
      : 'N/A';

    console.log('\n=== SUMMARY ===');
    console.log(`Total shelters: ${shelters.length}`);
    console.log(`Missing name: ${noName}`);
    console.log(`Mile range: ${mileRange}`);
    console.log('===============\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
