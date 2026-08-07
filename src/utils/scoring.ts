import type { TierName } from '../types';

interface ScoringResult {
  score: number;
  tier: TierName;
}

// Single source of truth for the "perfect game" total — this year's official
// AT length. Update this one number annually; every score, tier band, and
// the perfect-game total scale together automatically.
export const MAX_SCORE = 2197.9;

// The 352/220/88/etc. band boundaries below were tuned for this reference
// max. SCALE keeps their proportions identical while the absolute numbers
// track MAX_SCORE, so nothing here is a new hardcoded magic number.
const OLD_MAX_SCORE = 2200;
const SCALE = MAX_SCORE / OLD_MAX_SCORE;
const PER_ROUND_MAX = MAX_SCORE / 5;

// Linear interpolation helper. Returns the exact float — never rounds.
// Rounding to 1 decimal happens only at display time, never here: rounding
// per-round before summing breaks the perfect-game total (2197.9/5 rounds to
// 439.6, and 439.6 × 5 = 2198.0, not 2197.9).
function lerp(t: number, min: number, max: number): number {
  return max - t * (max - min);
}

// Clamp t to [0,1]
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function calculateScore(distanceMiles: number): ScoringResult {
  if (distanceMiles <= 25) {
    const t = clamp01(distanceMiles / 25);
    return { score: lerp(t, 352 * SCALE, PER_ROUND_MAX), tier: 'Thru-Hiker' };
  }
  if (distanceMiles <= 100) {
    const t = clamp01((distanceMiles - 25) / 75);
    return { score: lerp(t, 220 * SCALE, 351 * SCALE), tier: 'LASHer' };
  }
  if (distanceMiles <= 250) {
    const t = clamp01((distanceMiles - 100) / 150);
    return { score: lerp(t, 88 * SCALE, 219 * SCALE), tier: 'Section Hiker' };
  }
  // 250+ miles — scale down to 0 at the full AT length
  const t = clamp01((distanceMiles - 250) / 1950);
  return { score: lerp(t, 0, 87 * SCALE), tier: 'Day Hiker' };
}

// Overall (5-round total) tier, as opposed to calculateScore's per-round tier.
export function overallTier(totalScore: number): TierName {
  if (totalScore >= MAX_SCORE * 0.8) return 'Thru-Hiker';
  if (totalScore >= MAX_SCORE * 0.5) return 'LASHer';
  if (totalScore >= MAX_SCORE * 0.2) return 'Section Hiker';
  return 'Day Hiker';
}

// Display-time formatting: always exactly 1 decimal. calculateScore() itself
// stays full-precision and unrounded — this is the "later phase" rounding,
// applied only where a score is shown.
export function formatScore(score: number): string {
  return score.toFixed(1);
}

export const TIER_COLORS: Record<TierName, string> = {
  'Thru-Hiker': '#2d7a2d',
  'LASHer': '#5a9e3a',
  'Section Hiker': '#c07820',
  'Day Hiker': '#b04020',
};
