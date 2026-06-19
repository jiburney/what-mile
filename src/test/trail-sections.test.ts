import { describe, it, expect } from 'vitest'
import { getTrailSection } from '../../api/_lib/trail-sections'

describe('getTrailSection', () => {
  it('Amicalola Falls is Georgia', () => {
    expect(getTrailSection(34.56, -84.19)).toBe('Georgia')
  })

  it('Springer Mountain is Georgia', () => {
    expect(getTrailSection(34.627, -84.193)).toBe('Georgia')
  })

  it('Blood Mountain is Georgia', () => {
    expect(getTrailSection(34.742, -83.935)).toBe('Georgia')
  })

  it('Damascus Virginia is Virginia', () => {
    expect(getTrailSection(36.638, -81.778)).toBe('Virginia')
  })

  it('Katahdin is Maine', () => {
    expect(getTrailSection(45.904, -68.921)).toBe('Maine')
  })

  it('returns Unknown for coordinates outside AT', () => {
    expect(getTrailSection(25.0, -80.0)).toBe('Unknown')
  })
})
