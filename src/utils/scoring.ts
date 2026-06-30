import type { TierName } from '../types';

interface ScoringResult {
  score: number;
  tier: TierName;
}

// Linear interpolation helper
function lerp(t: number, min: number, max: number): number {
  return Math.round(max - t * (max - min));
}

// Clamp t to [0,1]
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// Per-round max is 440, so a perfect 5-round game totals 2200 — symbolically
// the full length of the AT (2198.4mi). Tier bands are the original 0-1000
// scale scaled by 0.44 and rounded.
export function calculateScore(distanceMiles: number): ScoringResult {
  if (distanceMiles <= 25) {
    const t = clamp01(distanceMiles / 25);
    return { score: lerp(t, 352, 440), tier: 'Thru-Hiker' };
  }
  if (distanceMiles <= 100) {
    const t = clamp01((distanceMiles - 25) / 75);
    return { score: lerp(t, 220, 351), tier: 'LASHer' };
  }
  if (distanceMiles <= 250) {
    const t = clamp01((distanceMiles - 100) / 150);
    return { score: lerp(t, 88, 219), tier: 'Section Hiker' };
  }
  // 250+ miles — scale down to 0 at 2200 miles (full AT length)
  const t = clamp01((distanceMiles - 250) / 1950);
  return { score: lerp(t, 0, 87), tier: 'Day Hiker' };
}

export const TIER_COLORS: Record<TierName, string> = {
  'Thru-Hiker': '#2d7a2d',
  'LASHer': '#5a9e3a',
  'Section Hiker': '#c07820',
  'Day Hiker': '#b04020',
};
