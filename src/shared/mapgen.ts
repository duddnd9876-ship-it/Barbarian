import { OBSTACLE_RATIO, ROUGH_RATIO } from './config'
import { axialKey, hexRing, hexSpiral, neighborsOf } from './hex'
import { createRng } from './rng'
import type { AxialCoord, HexKey, PlayerId, Terrain, Tile } from './types'

export interface MapGenResult {
  radius: number
  tiles: Record<HexKey, Tile>
  bases: Record<HexKey, PlayerId>
  startPositions: Record<PlayerId, AxialCoord>
}

/** 인원수에 비례한 맵 반지름. 2인 -> r5(91칸), 6인 -> r9(271칸). */
export function mapRadius(playerCount: number): number {
  return 3 + playerCount
}

const CENTER: AxialCoord = { q: 0, r: 0 }

/**
 * 시드 기반 결정론 맵 생성. 같은 seed + playerIds 순서면 항상 완전히 동일한 맵이 나온다.
 * 시작 위치는 중심에서 등거리인 링 위에 각도로 균등 배치하고, 기지+주변 1칸은 평지로 강제한다.
 */
export function generateMap(seed: number, playerIds: PlayerId[]): MapGenResult {
  const radius = mapRadius(playerIds.length)
  const rng = createRng(seed)
  const allCoords = hexSpiral(CENTER, radius)

  const baseRingRadius = Math.max(1, radius - 1)
  const ring = hexRing(CENTER, baseRingRadius)

  const startPositions: Record<PlayerId, AxialCoord> = {}
  const bases: Record<HexKey, PlayerId> = {}
  const forcedPlains = new Set<HexKey>()

  playerIds.forEach((pid, i) => {
    const idx = Math.floor((i * ring.length) / playerIds.length)
    const coord = ring[idx]
    startPositions[pid] = coord
    bases[axialKey(coord)] = pid
    forcedPlains.add(axialKey(coord))
    neighborsOf(coord).forEach((n) => forcedPlains.add(axialKey(n)))
  })

  const tiles: Record<HexKey, Tile> = {}
  for (const coord of allCoords) {
    const k = axialKey(coord)
    let terrain: Terrain
    if (forcedPlains.has(k)) {
      terrain = 'plains'
    } else {
      const roll = rng()
      if (roll < OBSTACLE_RATIO) terrain = 'obstacle'
      else if (roll < OBSTACLE_RATIO + ROUGH_RATIO) terrain = 'rough'
      else terrain = 'plains'
    }
    tiles[k] = { coord, terrain, baseOwner: bases[k] }
  }

  ensureConnectivity(tiles, Object.values(startPositions))

  return { radius, tiles, bases, startPositions }
}

/** 모든 기지가 장애물 없이 서로 도달 가능하도록, 필요한 최소한의 장애물만 평지로 되돌린다. */
function ensureConnectivity(tiles: Record<HexKey, Tile>, mustReach: AxialCoord[]): void {
  if (mustReach.length === 0) return

  const passable = (k: HexKey) => tiles[k]?.terrain !== 'obstacle'

  const reachableFrom = (start: AxialCoord): Set<HexKey> => {
    const seen = new Set<HexKey>([axialKey(start)])
    const queue: AxialCoord[] = [start]
    while (queue.length) {
      const cur = queue.shift()!
      for (const n of neighborsOf(cur)) {
        const k = axialKey(n)
        if (!tiles[k] || seen.has(k) || !passable(k)) continue
        seen.add(k)
        queue.push(n)
      }
    }
    return seen
  }

  let guard = 0
  const maxGuard = Object.keys(tiles).length
  while (guard++ < maxGuard) {
    const reached = reachableFrom(mustReach[0])
    const unreached = mustReach.find((p) => !reached.has(axialKey(p)))
    if (!unreached) return

    const path = shortestPathIgnoringObstacles(tiles, mustReach[0], unreached)
    for (const k of path) {
      if (tiles[k].terrain === 'obstacle') tiles[k] = { ...tiles[k], terrain: 'plains' }
    }
    if (path.length === 0) return // 안전장치: 경로 자체가 없으면(맵 밖) 더 이상 손쓸 수 없다
  }
}

function shortestPathIgnoringObstacles(
  tiles: Record<HexKey, Tile>,
  from: AxialCoord,
  to: AxialCoord,
): HexKey[] {
  const fromK = axialKey(from)
  const toK = axialKey(to)
  const prev = new Map<HexKey, HexKey | null>([[fromK, null]])
  const queue: AxialCoord[] = [from]

  while (queue.length) {
    const cur = queue.shift()!
    const curK = axialKey(cur)
    if (curK === toK) break
    for (const n of neighborsOf(cur)) {
      const k = axialKey(n)
      if (!tiles[k] || prev.has(k)) continue
      prev.set(k, curK)
      queue.push(n)
    }
  }

  if (!prev.has(toK)) return []
  const path: HexKey[] = []
  let cur: HexKey | null = toK
  while (cur !== null) {
    path.push(cur)
    cur = prev.get(cur) ?? null
  }
  return path
}
