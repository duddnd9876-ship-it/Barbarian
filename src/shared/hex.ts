import type { AxialCoord } from './types'

// Pointy-top 육각 그리드, axial 좌표. redblobgames.com/grids/hexagons 알고리즘 기반.

export function axialKey(c: AxialCoord): string {
  return `${c.q},${c.r}`
}

export function parseAxialKey(k: string): AxialCoord {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}

interface CubeCoord {
  x: number
  y: number
  z: number
}

function axialToCube(c: AxialCoord): CubeCoord {
  const x = c.q
  const z = c.r
  const y = -x - z
  return { x, y, z }
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ac = axialToCube(a)
  const bc = axialToCube(b)
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z))
}

const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function neighborsOf(c: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: c.q + d.q, r: c.r + d.r }))
}

/** 중심에서 정확히 radius만큼 떨어진 육각 타일들 (radius=0이면 중심 자기 자신). */
export function hexRing(center: AxialCoord, radius: number): AxialCoord[] {
  if (radius === 0) return [center]
  const results: AxialCoord[] = []
  let cur: AxialCoord = {
    q: center.q + AXIAL_DIRECTIONS[4].q * radius,
    r: center.r + AXIAL_DIRECTIONS[4].r * radius,
  }
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(cur)
      cur = { q: cur.q + AXIAL_DIRECTIONS[i].q, r: cur.r + AXIAL_DIRECTIONS[i].r }
    }
  }
  return results
}

/** 중심에서 radius 이내 모든 타일 (중심 포함). 맵 전체 타일 나열에 사용. */
export function hexSpiral(center: AxialCoord, radius: number): AxialCoord[] {
  const results: AxialCoord[] = [center]
  for (let k = 1; k <= radius; k++) results.push(...hexRing(center, k))
  return results
}
