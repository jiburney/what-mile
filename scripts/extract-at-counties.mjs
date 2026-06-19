/**
 * Extract AT-corridor county boundaries from public GeoJSON data
 *
 * Downloads county boundaries and extracts only the 14 states along the
 * Appalachian Trail corridor to minimize bundle size.
 *
 * Source: plotly/datasets (simplified US counties GeoJSON)
 * License: Public domain
 *
 * Usage: node scripts/extract-at-counties.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'api', 'data', 'at-counties.geojson');

// FIPS state codes for AT corridor states
const AT_STATE_FIPS = new Set([
  '13', // GA
  '37', // NC
  '47', // TN
  '51', // VA
  '54', // WV
  '24', // MD
  '42', // PA
  '34', // NJ
  '36', // NY
  '09', // CT
  '25', // MA
  '50', // VT
  '33', // NH
  '23', // ME
]);

// FIPS to state abbrev mapping
const FIPS_TO_STATE = {
  '13': 'GA', '37': 'NC', '47': 'TN', '51': 'VA', '54': 'WV',
  '24': 'MD', '42': 'PA', '34': 'NJ', '36': 'NY', '09': 'CT',
  '25': 'MA', '50': 'VT', '33': 'NH', '23': 'ME',
};

async function main() {
  console.log('Downloading US county boundaries...');

  const url = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const fullData = await response.json();
  console.log(`Downloaded ${fullData.features.length} counties nationwide`);

  // Filter to AT corridor states and add state abbrev to properties
  const atCounties = {
    type: 'FeatureCollection',
    features: fullData.features
      .filter(feature => AT_STATE_FIPS.has(feature.properties.STATE))
      .map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          STUSPS: FIPS_TO_STATE[feature.properties.STATE],
        }
      })),
    metadata: {
      source: url,
      extractedDate: new Date().toISOString(),
      states: Object.values(FIPS_TO_STATE).sort(),
      license: 'Public domain',
    }
  };

  console.log(`Filtered to ${atCounties.features.length} counties in AT corridor`);

  // Write to api/data/
  writeFileSync(OUTPUT_PATH, JSON.stringify(atCounties));

  const sizeKB = Math.round(JSON.stringify(atCounties).length / 1024);
  console.log(`✓ Wrote ${OUTPUT_PATH} (${sizeKB} KB)`);
  console.log('\nCounties by state:');

  const byState = {};
  atCounties.features.forEach(f => {
    const state = f.properties.STUSPS;
    byState[state] = (byState[state] || 0) + 1;
  });

  Object.entries(byState).sort().forEach(([state, count]) => {
    console.log(`  ${state}: ${count} counties`);
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
