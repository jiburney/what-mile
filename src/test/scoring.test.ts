import { describe, it, expect } from 'vitest'
import { calculateScore, overallTier, MAX_SCORE } from '../utils/scoring'
import { distanceMiles } from '../utils/distance'

describe('calculateScore', () => {
  it('returns max round score (MAX_SCORE/5) for an exact guess', () => {
    const result = calculateScore(0)
    expect(result.score).toBe(MAX_SCORE / 5)
    expect(result.tier).toBe('Thru-Hiker')
  })

  it('classifies a 10-mile miss as Thru-Hiker with score 351.664-439.58', () => {
    const result = calculateScore(10)
    expect(result.tier).toBe('Thru-Hiker')
    expect(result.score).toBeGreaterThan(351.664)
    expect(result.score).toBeLessThan(439.58)
  })

  it('classifies a 50-mile miss as LASHer', () => {
    const result = calculateScore(50)
    expect(result.tier).toBe('LASHer')
    expect(result.score).toBeGreaterThanOrEqual(219.79)
    expect(result.score).toBeLessThanOrEqual(350.665)
  })

  it('classifies a 150-mile miss as Section Hiker', () => {
    const result = calculateScore(150)
    expect(result.tier).toBe('Section Hiker')
    expect(result.score).toBeGreaterThanOrEqual(87.916)
    expect(result.score).toBeLessThanOrEqual(218.791)
  })

  it('classifies a very distant guess as Day Hiker with a low score', () => {
    const result = calculateScore(1500)
    expect(result.tier).toBe('Day Hiker')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThan(87.916)
  })

  it('scales toward 0 at the full AT length (~2200 mi)', () => {
    const result = calculateScore(2200)
    expect(result.tier).toBe('Day Hiker')
    expect(result.score).toBe(0)
  })

  it('lands exactly on the Thru-Hiker/LASHer boundary at 25 miles', () => {
    const result = calculateScore(25)
    expect(result.tier).toBe('Thru-Hiker')
    expect(result.score).toBeCloseTo(351.664, 5)
  })

  it('sums five perfect rounds to exactly 2197.9, not 2198.0', () => {
    // Rounding each round to 1 decimal before summing would break this:
    // 2197.9/5 = 439.58, which rounds to 439.6, and 439.6 × 5 = 2198.0.
    let total = 0
    for (let i = 0; i < 5; i++) {
      total += calculateScore(0).score
    }
    expect(total).toBe(2197.9)
  })
})

describe('overallTier', () => {
  it('classifies a perfect total as Thru-Hiker', () => {
    expect(overallTier(2197.9)).toBe('Thru-Hiker')
  })

  it('matches the calculateScore tier bands at MAX_SCORE proportions', () => {
    expect(overallTier(MAX_SCORE * 0.8)).toBe('Thru-Hiker')
    expect(overallTier(MAX_SCORE * 0.8 - 1)).toBe('LASHer')
    expect(overallTier(MAX_SCORE * 0.5)).toBe('LASHer')
    expect(overallTier(MAX_SCORE * 0.5 - 1)).toBe('Section Hiker')
    expect(overallTier(MAX_SCORE * 0.2)).toBe('Section Hiker')
    expect(overallTier(MAX_SCORE * 0.2 - 1)).toBe('Day Hiker')
    expect(overallTier(0)).toBe('Day Hiker')
  })
})

describe('distanceMiles', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceMiles(34.627, -84.193, 34.627, -84.193)).toBe(0)
  })

  it('calculates a reasonable distance between two nearby AT points', () => {
    const dist = distanceMiles(34.627, -84.193, 34.742, -83.935)
    expect(dist).toBeGreaterThan(10)
    expect(dist).toBeLessThan(45)
  })

  it('calculates the straight-line distance between Springer and Katahdin', () => {
    // Trail length is ~2,200 mi, but the great-circle (straight-line) distance is ~1,100 mi.
    const dist = distanceMiles(34.627, -84.193, 45.904, -68.921)
    expect(dist).toBeGreaterThan(1000)
    expect(dist).toBeLessThan(1200)
  })
})
