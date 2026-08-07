// Determine which AT section (US state) a photo is in based on GPS coordinates
// Latitude ranges are approximate — the AT winds considerably, so this is best-effort classification

export function getTrailSection(lat: number, lng: number): string {
  // Rough AT corridor longitude bounds: -84.2 (GA start) to -66.9 (ME end)
  // Use longitude as tiebreaker for overlapping latitude ranges (AT runs northeast)

  // Georgia: Springer Mountain to NC border
  if (lat >= 34.6 && lat < 35.1) return 'Georgia';

  // North Carolina / Tennessee border region (many miles shared)
  if (lat >= 35.1 && lat < 36.6) {
    // Tennessee is west, North Carolina is east
    return lng < -83.0 ? 'Tennessee' : 'North Carolina';
  }

  // Virginia: longest state on the AT (~550 miles)
  if (lat >= 36.6 && lat < 39.3) return 'Virginia';

  // West Virginia: tiny sliver near Harpers Ferry
  if (lat >= 39.3 && lat < 39.5) return 'West Virginia';

  // Maryland: short section (~40 miles)
  if (lat >= 39.5 && lat < 39.75) return 'Maryland';

  // Pennsylvania: rocky, ~230 miles
  if (lat >= 39.75 && lat < 41.0) return 'Pennsylvania';

  // New Jersey: ~72 miles
  if (lat >= 41.0 && lat < 41.2) return 'New Jersey';

  // New York: ~88 miles
  if (lat >= 41.2 && lat < 41.9) return 'New York';

  // Connecticut: ~52 miles
  if (lat >= 41.9 && lat < 42.1) return 'Connecticut';

  // Massachusetts: ~90 miles
  if (lat >= 42.1 && lat < 42.75) return 'Massachusetts';

  // Vermont: ~150 miles
  if (lat >= 42.75 && lat < 45.0) {
    // New Hampshire overlaps in the north
    return lat < 44.0 ? 'Vermont' : (lng < -72.0 ? 'Vermont' : 'New Hampshire');
  }

  // New Hampshire: White Mountains, ~160 miles
  if (lat >= 44.0 && lat < 45.3) return 'New Hampshire';

  // Maine: northern terminus at Katahdin (~280 miles)
  if (lat >= 45.1 && lat <= 47.5) return 'Maine';

  // Outside known AT range
  return 'Unknown';
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  'Georgia': 'GA',
  'Tennessee': 'TN',
  'North Carolina': 'NC',
  'Virginia': 'VA',
  'West Virginia': 'WV',
  'Maryland': 'MD',
  'Pennsylvania': 'PA',
  'New Jersey': 'NJ',
  'New York': 'NY',
  'Connecticut': 'CT',
  'Massachusetts': 'MA',
  'Vermont': 'VT',
  'New Hampshire': 'NH',
  'Maine': 'ME',
};

// For compact labels (card eyebrows, chips) where the full state name would
// get truncated or force wrapping — "Massachusetts" and "North Carolina"
// are the longest offenders. Falls back to the input unchanged for
// 'Unknown' or anything not in the map, rather than guessing.
export function abbreviateState(state: string): string {
  return STATE_ABBREVIATIONS[state] ?? state;
}

const ABBREVIATION_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([full, abbr]) => [abbr, full])
);

// Parses the trusted, geocoded locationName ("Madison County, NC") rather
// than deriving state from lat/lng via getTrailSection(). The two CAN
// disagree near a state border — getTrailSection is an approximate corridor
// heuristic, locationName is real geocoding — and a photo like Carter
// County, TN showing "NC" in one place and "TN" in another reads as broken
// to anyone who actually knows the trail. Always deriving from the same
// string the location name itself displays makes that disagreement
// impossible by construction, not just unlikely.
export function parseLocationName(locationName: string): {
  place: string;
  stateAbbr: string | null;
  stateFull: string | null;
} {
  const match = locationName.match(/^(.*),\s*([A-Z]{2})$/);
  if (!match) {
    return { place: locationName, stateAbbr: null, stateFull: null };
  }
  const [, place, stateAbbr] = match;
  return {
    place,
    stateAbbr,
    stateFull: ABBREVIATION_TO_STATE[stateAbbr] ?? null,
  };
}
