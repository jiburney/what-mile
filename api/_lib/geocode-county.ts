/**
 * Offline county geocoding using point-in-polygon lookup
 *
 * Determines county name from lat/lng coordinates using pre-loaded
 * AT-corridor county boundaries (no external API calls).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTIES_PATH = join(__dirname, '..', 'data', 'at-counties.geojson');

interface CountyFeature extends Feature {
  properties: {
    NAME: string;        // County name (e.g. "Lumpkin")
    STUSPS: string;      // State abbreviation (e.g. "GA")
    STATE: string;       // FIPS code
    COUNTY: string;      // County FIPS
  };
  geometry: Polygon | MultiPolygon;
}

interface CountyCollection {
  type: 'FeatureCollection';
  features: CountyFeature[];
}

// Module-level cache — loaded once per function lifetime
let countyData: CountyCollection | null = null;

function loadCountyData(): CountyCollection {
  if (countyData) return countyData;

  try {
    const raw = readFileSync(COUNTIES_PATH, 'utf-8');
    countyData = JSON.parse(raw);
    console.log(`Loaded ${countyData!.features.length} county polygons`);
    return countyData!;
  } catch (err) {
    console.error('Failed to load county data:', err);
    throw new Error('County data not available');
  }
}

/**
 * Get county location string from coordinates
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns "{County} County, {ST}" or null if not found
 *
 * @example
 * getCountyLocation(34.6184, -83.9692) // "Lumpkin County, GA"
 * getCountyLocation(37.3933, -80.0988) // "Roanoke County, VA"
 */
export function getCountyLocation(lat: number, lng: number): string | null {
  const counties = loadCountyData();
  const pt = point([lng, lat]);

  for (const county of counties.features) {
    try {
      if (booleanPointInPolygon(pt, county.geometry)) {
        const countyName = county.properties.NAME;
        const stateAbbr = county.properties.STUSPS;
        return `${countyName} County, ${stateAbbr}`;
      }
    } catch (err) {
      // Invalid geometry — skip
      console.error(`Invalid geometry for ${county.properties.NAME}, ${county.properties.STUSPS}:`, err);
      continue;
    }
  }

  // Point not in any county
  return null;
}
