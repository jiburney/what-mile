#!/usr/bin/env node
/**
 * fetch-at-data.mjs
 *
 * Fetches authoritative AT centerline and shelter data from NPS APPA ArcGIS services,
 * computes guidebook-scaled NoBo/SoBo miles, and generates scripts/shelters.json.
 *
 * Dependencies: npm install --save-dev @turf/turf
 * Usage: node scripts/fetch-at-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Official AT guidebook length (2023 AWOL guide)
const OFFICIAL_AT_LENGTH_MI = 2197.4;

// NPS APPA ArcGIS service URLs
const CENTERLINE_URL = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/ANST_Centerline/FeatureServer/0';
const SHELTERS_URL = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/ANST_Facilities/FeatureServer/4';

/**
 * Fetch GeoJSON from ArcGIS FeatureServer with pagination
 */
async function fetchArcGISLayer(layerUrl, layerName) {
  console.log(`Fetching ${layerName} from ArcGIS...`);

  let allFeatures = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${layerUrl}/query?where=1=1&outFields=*&f=geojson&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${layerName}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      hasMore = false;
    } else {
      allFeatures.push(...data.features);
      console.log(`  Batch ${Math.floor(offset / batchSize) + 1}: ${data.features.length} features`);
      offset += batchSize;

      // Continue if we got a full batch
      if (data.features.length < batchSize) {
        hasMore = false;
      }
    }
  }

  console.log(`✓ Fetched ${allFeatures.length} ${layerName} features`);

  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  return geojson;
}

/**
 * Process centerline: compute total length and create segment collection
 */
function processCenterline(geojson) {
  console.log('\nProcessing centerline...');

  const lineFeatures = geojson.features.filter(
    f => f.geometry && f.geometry.type === 'LineString'
  );

  console.log(`Found ${lineFeatures.length} LineString segments`);

  // Compute total measured length by summing all segments
  let measuredLengthMi = 0;
  for (const feature of lineFeatures) {
    const line = turf.lineString(feature.geometry.coordinates);
    measuredLengthMi += turf.length(line, { units: 'miles' });
  }

  console.log(`✓ Total measured length: ${measuredLengthMi.toFixed(1)} miles`);

  // For projection, we need a combined representation
  // Use a MultiLineString or find segments by proximity
  const segments = lineFeatures.map(f => turf.lineString(f.geometry.coordinates));

  return { segments, measuredLengthMi };
}

/**
 * Process shelters: project onto closest segment, compute scaled miles using latitude
 */
function processShelters(sheltersGeoJSON, segments, measuredLengthMi) {
  console.log('\nProcessing shelters...');

  const scaleFactor = OFFICIAL_AT_LENGTH_MI / measuredLengthMi;
  console.log(`Scale factor: ${scaleFactor.toFixed(4)} (${OFFICIAL_AT_LENGTH_MI} / ${measuredLengthMi.toFixed(1)})`);

  const results = [];

  for (const feature of sheltersGeoJSON.features) {
    if (!feature.geometry || feature.geometry.type !== 'Point') continue;

    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties?.Name || null;

    const point = turf.point([lng, lat]);

    // Find closest segment
    let minDistance = Infinity;
    let closestSnap = null;

    for (const segment of segments) {
      const snapped = turf.nearestPointOnLine(segment, point, { units: 'meters' });
      const distance = turf.distance(point, snapped, { units: 'meters' });

      if (distance < minDistance) {
        minDistance = distance;
        closestSnap = snapped;
      }
    }

    // Use latitude-based approximation for NoBo mile
    // AT spans ~34.6 (Springer) to ~45.9 (Katahdin) = 11.3 degrees
    // Official length: 2197.4 miles
    const latRange = 45.9 - 34.6;
    const rawNoboMile = ((lat - 34.6) / latRange) * OFFICIAL_AT_LENGTH_MI;
    const nobo_mile = Math.round(Math.max(0, Math.min(OFFICIAL_AT_LENGTH_MI, rawNoboMile)) * 10) / 10;
    const sobo_mile = Math.round((OFFICIAL_AT_LENGTH_MI - nobo_mile) * 10) / 10;
    const offtrail_m = Math.round(minDistance);

    results.push({
      name,
      lat,
      lng,
      nobo_mile,
      sobo_mile,
      offtrail_m,
    });
  }

  // Sort by nobo_mile
  results.sort((a, b) => a.nobo_mile - b.nobo_mile);

  console.log(`✓ Processed ${results.length} shelters`);

  return results;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Ensure data directory exists
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // 1. Fetch centerline
    const centerlineGeoJSON = await fetchArcGISLayer(CENTERLINE_URL, 'centerline');
    fs.writeFileSync(
      path.join(DATA_DIR, 'centerline.geojson'),
      JSON.stringify(centerlineGeoJSON, null, 2)
    );
    console.log(`✓ Saved scripts/data/centerline.geojson`);

    // 2. Fetch shelters
    const sheltersGeoJSON = await fetchArcGISLayer(SHELTERS_URL, 'shelters');
    fs.writeFileSync(
      path.join(DATA_DIR, 'shelters.geojson'),
      JSON.stringify(sheltersGeoJSON, null, 2)
    );
    console.log(`✓ Saved scripts/data/shelters.geojson`);

    // 3. Process centerline
    const { segments, measuredLengthMi } = processCenterline(centerlineGeoJSON);

    // 4. Process shelters
    const shelters = processShelters(sheltersGeoJSON, segments, measuredLengthMi);

    // 5. Output shelters.json
    const outputPath = path.join(__dirname, 'shelters.json');
    fs.writeFileSync(outputPath, JSON.stringify(shelters, null, 2));
    console.log(`\n✓ Wrote ${shelters.length} shelters to scripts/shelters.json`);

    // 6. Summary
    const unnamedCount = shelters.filter(s => !s.name).length;
    const mileRange = shelters.length > 0
      ? `${shelters[0].nobo_mile}–${shelters[shelters.length - 1].nobo_mile} mi`
      : 'N/A';

    console.log('\n=== SUMMARY ===');
    console.log(`Data source: NPS APPA ArcGIS (official)`);
    console.log(`Centerline: ${centerlineGeoJSON.features.length} segments`);
    console.log(`Shelters: ${shelters.length} total, ${unnamedCount} unnamed`);
    console.log(`Mile range: ${mileRange}`);
    console.log(`Measured length: ${measuredLengthMi.toFixed(1)} mi`);
    console.log(`Scale factor: ${(OFFICIAL_AT_LENGTH_MI / measuredLengthMi).toFixed(4)}`);

    // 7. Validation
    console.log('\n=== VALIDATION ===');
    const springer = shelters.find(s => s.name && s.name.includes('Springer Mountain'));
    const hawk = shelters.find(s => s.name && s.name.includes('Hawk Mountain'));
    const blood = shelters.find(s => s.name && s.name.includes('Blood Mountain'));

    if (springer) console.log(`Springer Mountain Shelter: ${springer.nobo_mile} mi (expect ~0.2)`);
    if (hawk) console.log(`Hawk Mountain Shelter: ${hawk.nobo_mile} mi (expect ~8.1)`);
    if (blood) console.log(`Blood Mountain Shelter: ${blood.nobo_mile} mi (expect ~28.9)`);

    console.log('==================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
