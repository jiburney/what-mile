import { describe, it, expect } from 'vitest'
import { calculateScore } from '../utils/scoring'
import { distanceMiles } from '../utils/distance'

describe('calculateScore', () => {
  it('returns max round score (440) for an exact guess', () => {
    const result = calculateScore(0)
    expect(result.score).toBe(440)
    expect(result.tier).toBe('Thru-Hiker')
  })

  it('classifies a 10-mile miss as Thru-Hiker with score 352-440', () => {
    const result = calculateScore(10)
    expect(result.tier).toBe('Thru-Hiker')
    expect(result.score).toBeGreaterThan(352)
    expect(result.score).toBeLessThan(440)
  })

  it('classifies a 50-mile miss as LASHer', () => {
    const result = calculateScore(50)
    expect(result.tier).toBe('LASHer')
    expect(result.score).toBeGreaterThanOrEqual(220)
    expect(result.score).toBeLessThanOrEqual(351)
  })

  it('classifies a 150-mile miss as Section Hiker', () => {
    const result = calculateScore(150)
    expect(result.tier).toBe('Section Hiker')
    expect(result.score).toBeGreaterThanOrEqual(88)
    expect(result.score).toBeLessThanOrEqual(219)
  })

  it('classifies a very distant guess as Day Hiker with a low score', () => {
    const result = calculateScore(1500)
    expect(result.tier).toBe('Day Hiker')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThan(88)
  })

  it('scales toward 0 at the full AT length (~2200 mi)', () => {
    const result = calculateScore(2200)
    expect(result.tier).toBe('Day Hiker')
    expect(result.score).toBe(0)
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
