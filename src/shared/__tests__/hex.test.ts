import { describe, expect, it } from 'vitest'
import { axialKey, hexDistance, hexRing, hexSpiral, neighborsOf, parseAxialKey } from '../hex'

describe('axialKey / parseAxialKey', () => {
  it('round-trips', () => {
    const c = { q: -3, r: 5 }
    expect(parseAxialKey(axialKey(c))).toEqual(c)
  })
})

describe('hexDistance', () => {
  it('is 0 for the same tile', () => {
    expect(hexDistance({ q: 2, r: -1 }, { q: 2, r: -1 })).toBe(0)
  })

  it('is 1 for direct neighbors', () => {
    const center = { q: 0, r: 0 }
    for (const n of neighborsOf(center)) {
      expect(hexDistance(center, n)).toBe(1)
    }
  })

  it('matches known coordinate pairs', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3)
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4)
    expect(hexDistance({ q: -2, r: 1 }, { q: 2, r: -1 })).toBe(4)
  })
})

describe('neighborsOf', () => {
  it('always returns exactly 6 tiles', () => {
    expect(neighborsOf({ q: 0, r: 0 })).toHaveLength(6)
  })
})

describe('hexRing', () => {
  it('returns the center itself for radius 0', () => {
    expect(hexRing({ q: 0, r: 0 }, 0)).toEqual([{ q: 0, r: 0 }])
  })

  it('has 6*radius tiles, all at exactly that distance', () => {
    const center = { q: 0, r: 0 }
    for (const radius of [1, 2, 3, 5]) {
      const ring = hexRing(center, radius)
      expect(ring).toHaveLength(6 * radius)
      for (const tile of ring) {
        expect(hexDistance(center, tile)).toBe(radius)
      }
    }
  })
})

describe('hexSpiral', () => {
  it('has 3r^2+3r+1 tiles (standard hex-grid tile count)', () => {
    const center = { q: 0, r: 0 }
    for (const radius of [0, 1, 5, 9]) {
      const spiral = hexSpiral(center, radius)
      expect(spiral).toHaveLength(3 * radius * radius + 3 * radius + 1)
    }
  })

  it('contains no duplicate coordinates', () => {
    const spiral = hexSpiral({ q: 0, r: 0 }, 4)
    const keys = new Set(spiral.map(axialKey))
    expect(keys.size).toBe(spiral.length)
  })
})
