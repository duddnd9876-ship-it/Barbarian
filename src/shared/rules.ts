import { MOVE_POINTS, ROUGH_MOVE_COST } from './config'
import { axialKey, neighborsOf } from './hex'
import type { AxialCoord, GameState, HexKey, PlayerId, Tile, Unit } from './types'

export function tileAt(state: GameState, coord: AxialCoord): Tile | undefined {
  return state.tiles[axialKey(coord)]
}

export function unitAt(state: GameState, coord: AxialCoord): Unit | undefined {
  const k = axialKey(coord)
  return Object.values(state.units).find((u) => u.alive && u.pos && axialKey(u.pos) === k)
}

export function moveCost(terrain: Tile['terrain']): number {
  return terrain === 'rough' ? ROUGH_MOVE_COST : 1
}

export function basesOwnedBy(state: GameState, playerId: PlayerId): HexKey[] {
  return Object.entries(state.bases)
    .filter(([, owner]) => owner === playerId)
    .map(([k]) => k)
}

/**
 * 이동 가능 타일 목록 (도착 시 남는 이동력 포함). 문명 규칙 차용:
 * 이동력이 1 이상 남아있으면 비용과 무관하게 다음 타일에 진입할 수 있다.
 */
export function reachableTiles(state: GameState, playerId: PlayerId): Map<HexKey, number> {
  const unit = state.units[playerId]
  const visited = new Map<HexKey, number>()
  if (!unit || !unit.alive || !unit.pos) return visited

  visited.set(axialKey(unit.pos), unit.movesLeft)
  const queue: AxialCoord[] = [unit.pos]

  while (queue.length) {
    const cur = queue.shift()!
    const remaining = visited.get(axialKey(cur))!
    if (remaining < 1) continue
    for (const n of neighborsOf(cur)) {
      const nk = axialKey(n)
      const tile = state.tiles[nk]
      if (!tile || tile.terrain === 'obstacle') continue
      if (unitAt(state, n)) continue
      const newRemaining = Math.max(0, remaining - moveCost(tile.terrain))
      if (!visited.has(nk) || visited.get(nk)! < newRemaining) {
        visited.set(nk, newRemaining)
        queue.push(n)
      }
    }
  }

  visited.delete(axialKey(unit.pos))
  return visited
}

export function attackableTargets(state: GameState, playerId: PlayerId): AxialCoord[] {
  const unit = state.units[playerId]
  if (!unit || !unit.alive || !unit.pos || unit.movesLeft < 1) return []
  return neighborsOf(unit.pos).filter((n) => {
    const defender = unitAt(state, n)
    return !!defender && defender.playerId !== playerId
  })
}

export function canFortify(state: GameState, playerId: PlayerId): boolean {
  const unit = state.units[playerId]
  return !!unit && unit.alive && !unit.fortified && unit.movesLeft === MOVE_POINTS
}
