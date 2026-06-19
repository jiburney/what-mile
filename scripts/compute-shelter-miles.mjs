#!/usr/bin/env node
/**
 * compute-shelter-miles.mjs  (v2 — anchor-backbone model)
 *
 * Regenerates scripts/shelters.json with AT mileage and produces a reusable
 * mile model (scripts/data/mile-calibration.json) for turning coordinates into
 * trail miles.
 *
 * APPROACH: We do NOT stitch the raw NPS centerline. Reconstructing the trail's
 * order from 3,023 scattered segments proved unreliable (greedy chaining jumps
 * across gaps). Instead we use the 2023 Data Book shelters themselves as the
 * measuring stick: 241 shelters with exact, correctly-ordered miles, spaced
 * ~8 mi apart down the whole trail. A point's mile = its projection onto the
 * polyline through those shelters (sorted by mile), interpolated between the two
 * bracketing shelters. Robust, fast, no centerline required.
 *
 * Tradeoff: between two shelters the line is a straight chord, so a point can be
 * off by ~1-2 mi where the trail curves. Shelters themselves are exact.
 *
 * Dependencies: @turf/turf
 * Usage: node scripts/compute-shelter-miles.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OFFICIAL_AT_LENGTH = 2198.4;
const MILES_TO_METERS = 1609.34;

console.log('=== STEP 0: LOADING DATA ===\n');

const sheltersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/shelters.geojson'), 'utf-8'));
const referenceData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/at-reference-2023.json'), 'utf-8'));

console.log(`Loaded ${sheltersData.features.length} shelter features`);
console.log(`Loaded ${referenceData.waypoints.length} reference waypoints`);
console.log();

//
// STEP 1: NAME MATCHING (shelter coordinates <-> Data Book miles)
//
console.log('=== STEP 1: NAME MATCHING ===\n');

function normalizeName(name) {
  if (!name) return '';
  let normalized = name.toLowerCase();

  // Strip trailing type words — repeat to handle double suffixes like
  // "Lean-to Shelter" (NPS appends "Shelter" even to lean-tos).
  let _prev;
  do {
    _prev = normalized;
    normalized = normalized
      .replace(/\s+(shelter|shelters|lean-to|lean-tos|leanto|leantos|hut|cabin|campsite|campsites)$/g, '')
      .trim();
  } while (normalized !== _prev);

  normalized = normalized.replace(/\s+side\s+trail/g, '');
  normalized = normalized.replace(/\bmtn\b/g, 'mountain');
  normalized = normalized.replace(/\bmt\b/g, 'mountain');
  normalized = normalized.replace(/\([^)]*\)/g, '');
  normalized = normalized.replace(/['’‘`]/g, '');
  normalized = normalized.replace(/[^\w\s-]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

const npsOfficialShelters = sheltersData.features.filter(
  f => f.properties.Status === 'Official A.T. Shelter'
);
const referenceShelters = referenceData.waypoints.filter(w => w.is_shelter === true);

console.log(`NPS official shelters: ${npsOfficialShelters.length}`);
console.log(`Reference shelters: ${referenceShelters.length}`);
console.log();

const npsMap = new Map();
npsOfficialShelters.forEach(f => npsMap.set(normalizeName(f.properties.Name), f));

const refMap = new Map();
referenceShelters.forEach(w => refMap.set(normalizeName(w.name), w));

const matches = [];
const unmatchedNPS = [];
npsOfficialShelters.forEach(f => {
  const ref = refMap.get(normalizeName(f.properties.Name));
  if (ref) matches.push({ nps: f, ref });
  else unmatchedNPS.push(f.properties.Name);
});

const unmatchedRef = referenceShelters
  .filter(w => !npsMap.has(normalizeName(w.name)))
  .map(w => `${w.name} (${w.state}, ${w.at_mile} mi)`);

console.log(`Matched: ${matches.length} shelters`);
console.log(`Unmatched NPS: ${unmatchedNPS.length}, Unmatched reference: ${unmatchedRef.length}`);
console.log();

if (matches.length < 150) {
  console.error(`❌ GATE FAILED: only ${matches.length} shelters matched — need the anchors spread along the whole trail.`);
  process.exit(1);
}

//
// STEP 2: BUILD THE ANCHOR BACKBONE
//
console.log('=== STEP 2: BUILDING MILE MODEL (anchor backbone) ===\n');

// One anchor per matched shelter: coordinate + its exact Data Book mile.
const rawAnchors = matches
  .map(({ nps, ref }) => ({
    name: ref.name,
    state: ref.state,
    lng: nps.geometry.coordinates[0],
    lat: nps.geometry.coordinates[1],
    at_mile: ref.at_mile,
  }))
  .sort((a, b) => a.at_mile - b.at_mile);

// Enforce strictly increasing mile (guard against duplicates).
const anchors = [];
let lastMile = -Infinity;
for (const a of rawAnchors) {
  if (a.at_mile > lastMile) {
    anchors.push(a);
    lastMile = a.at_mile;
  }
}

console.log(`Built backbone from ${anchors.length} anchors (mile ${anchors[0].at_mile} → ${anchors[anchors.length - 1].at_mile})`);

// makeModel: given a list of anchors, return a project(point) -> { mile, off_mi }.
// Projects the point onto the polyline through the anchors, then interpolates
// the Data Book mile between the two bracketing anchors.
function makeModel(anchorList) {
  const coords = anchorList.map(a => [a.lng, a.lat]);
  const line = turf.lineString(coords);
  const atMile = anchorList.map(a => a.at_mile);

  const cumDist = [0];
  for (let i = 1; i < coords.length; i++) {
    cumDist[i] = cumDist[i - 1] + turf.distance(turf.point(coords[i - 1]), turf.point(coords[i]), { units: 'miles' });
  }

  function project(point) {
    const snapped = turf.nearestPointOnLine(line, point, { units: 'miles' });
    let i = snapped.properties.index;          // index of the segment's start vertex
    if (i < 0) i = 0;
    if (i >= coords.length - 1) i = coords.length - 2;
    const loc = snapped.properties.location;   // miles along the backbone
    const segLen = cumDist[i + 1] - cumDist[i];
    let f = segLen > 0 ? (loc - cumDist[i]) / segLen : 0;
    f = Math.max(0, Math.min(1, f));
    const mile = atMile[i] + f * (atMile[i + 1] - atMile[i]);
    return { mile, off_mi: snapped.properties.dist };
  }

  return { project };
}

const model = makeModel(anchors);
console.log('✓ Mile model ready\n');

//
// STEP 3: GENERATE SHELTERS.JSON
//
console.log('=== STEP 3: GENERATING SHELTERS.JSON ===\n');

const matchedNames = new Set(matches.map(m => m.nps.properties.Name));
const outputShelters = npsOfficialShelters.map(f => {
  const point = turf.point(f.geometry.coordinates);
  const { mile, off_mi } = model.project(point);

  let nobo_mile, mile_source;
  if (matchedNames.has(f.properties.Name)) {
    nobo_mile = matches.find(m => m.nps.properties.Name === f.properties.Name).ref.at_mile;
    mile_source = 'databook';
  } else {
    nobo_mile = Math.round(mile * 10) / 10;
    mile_source = 'projected';
  }

  return {
    name: f.properties.Name,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    nobo_mile,
    sobo_mile: Math.round((OFFICIAL_AT_LENGTH - nobo_mile) * 10) / 10,
    offtrail_m: Math.round(off_mi * MILES_TO_METERS),
    mile_source,
  };
}).sort((a, b) => a.nobo_mile - b.nobo_mile);

fs.writeFileSync(path.join(__dirname, 'shelters.json'), JSON.stringify(outputShelters, null, 2));
console.log(`✓ Generated ${outputShelters.length} shelters`);
console.log();

//
// STEP 4: VALIDATION (hold-out cross-validation)
//
console.log('=== STEP 4: VALIDATION ===\n');

const errors = [];
const worst = [];
anchors.forEach((held, idx) => {
  if (idx % 5 !== 0) return;
  if (idx === 0 || idx === anchors.length - 1) return; // endpoints can't be interpolated
  const holdoutModel = makeModel(anchors.filter(a => a.name !== held.name));
  const predicted = holdoutModel.project(turf.point([held.lng, held.lat])).mile;
  const error = Math.abs(predicted - held.at_mile);
  errors.push(error);
  worst.push({ name: held.name, state: held.state, predicted: Math.round(predicted * 10) / 10, actual: held.at_mile, error: Math.round(error * 10) / 10 });
});

worst.sort((a, b) => b.error - a.error);
const mean = errors.reduce((s, e) => s + e, 0) / errors.length;
const sorted = [...errors].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const max = sorted[sorted.length - 1];

console.log(`Hold-out (every 5th shelter, ${errors.length} tested):`);
console.log(`  Mean error:   ${mean.toFixed(2)} mi`);
console.log(`  Median error: ${median.toFixed(2)} mi`);
console.log(`  Max error:    ${max.toFixed(2)} mi`);
console.log(`\nWorst 10:`);
worst.slice(0, 10).forEach(e => console.log(`  ${e.name} (${e.state}): predicted ${e.predicted}, actual ${e.actual}, off ${e.error} mi`));
console.log();

// Canonical spot checks
console.log('Canonical checks:');
[
  { name: 'Springer Mtn', expected: 0.2 },
  { name: 'Hawk Mtn', expected: 8.1 },
  { name: 'Blood Mtn', expected: 28.9 },
  { name: 'Mark Noepel', expected: 1591.0 },
  { name: 'Beaver Brook', expected: 1807.3 },
  { name: 'Carlo Col', expected: 1916.9 },
].forEach(({ name, expected }) => {
  const s = outputShelters.find(s => s.name.includes(name));
  console.log(s ? `  ${s.name}: ${s.nobo_mile} mi (expected ~${expected})` : `  ⚠ ${name}: NOT FOUND`);
});
console.log();

//
// STEP 5: SAVE MILE MODEL
//
const calibrationData = {
  model: 'anchor-backbone',
  description: 'Mile = projection onto the polyline through Data Book shelters (sorted by official mile), interpolating between the two bracketing shelters. Rebuild the backbone from `anchors` and project a [lng,lat] point. No centerline required.',
  official_length_mi: OFFICIAL_AT_LENGTH,
  created: new Date().toISOString(),
  anchor_count: anchors.length,
  holdout_mean_error_mi: Math.round(mean * 100) / 100,
  anchors: anchors.map(a => ({ name: a.name, state: a.state, lat: a.lat, lng: a.lng, at_mile: a.at_mile })),
};
fs.writeFileSync(path.join(__dirname, 'data/mile-calibration.json'), JSON.stringify(calibrationData, null, 2));
console.log('✓ Saved scripts/data/mile-calibration.json\n');

//
// GATE
//
if (mean > 2.0) {
  console.error(`❌ GATE FAILED: hold-out mean error ${mean.toFixed(2)} mi > 2.0 mi`);
  process.exit(1);
}

console.log('=== SUMMARY ===\n');
console.log(`Anchors: ${anchors.length} | Shelters written: ${outputShelters.length}`);
console.log(`Hold-out mean error: ${mean.toFixed(2)} mi (median ${median.toFixed(2)}, max ${max.toFixed(2)})`);
console.log(`\n✅ SUCCESS: scripts/shelters.json + mile-calibration.json regenerated`);
