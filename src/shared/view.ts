import { VISION_BASE, VISION_UNIT } from './config'
import { axialKey, hexSpiral } from './hex'
import type { AxialCoord, GameEvent, GameState, HexKey, PlayerId } from './types'

/**
 * 기획서 1.6: 유닛 시야 2, 소유 기지 시야 3. 지형/기지 소유권은 항상 공개고,
 * 오직 "적 유닛이 지금 어디 있는가"만 숨긴다 — 이 게임의 핵심 긴장이 여기서 나온다.
 */
export function computeVisibleHexes(state: GameState, playerId: PlayerId): Set<HexKey> {
  const visible = new Set<HexKey>()

  const unit = state.units[playerId]
  if (unit && unit.alive && unit.pos) {
    for (const h of hexSpiral(unit.pos, VISION_UNIT)) visible.add(axialKey(h))
  }

  for (const [key, owner] of Object.entries(state.bases)) {
    if (owner !== playerId) continue
    const tile = state.tiles[key]
    if (!tile) continue
    for (const h of hexSpiral(tile.coord, VISION_BASE)) visible.add(axialKey(h))
  }

  return visible
}

/**
 * playerId 시점으로 필터링된 GameState 사본을 만든다. 자기 유닛은 항상 그대로 보이고,
 * 남의 유닛은 시야 밖이면 좌표를 지운다(pos: null) — HexBoard는 pos가 없으면 그리지 않으므로
 * 화면에서도, 네트워크로 전송되는 데이터에서도 실제로 사라진다.
 */
export function applyFogOfWar(
  state: GameState,
  playerId: PlayerId,
  visible: Set<HexKey> = computeVisibleHexes(state, playerId),
): GameState {
  const units: GameState['units'] = {}
  for (const [pid, unit] of Object.entries(state.units)) {
    if (pid === playerId) {
      units[pid] = unit
      continue
    }
    const isVisible = unit.alive && unit.pos !== null && visible.has(axialKey(unit.pos))
    units[pid] = isVisible ? unit : { ...unit, pos: null }
  }
  return { ...state, units }
}

function coordOf(event: GameEvent): AxialCoord | undefined {
  return (event.to as AxialCoord | undefined) ?? (event.at as AxialCoord | undefined)
}

/**
 * 이벤트(EVENTS 메시지)도 SNAPSHOT과 똑같은 기준으로 걸러야 한다 — 그렇지 않으면
 * 화면에는 안 보여도 네트워크 페이로드에는 적 위치가 그대로 실려 있어 치팅에 뚫린다.
 */
export function isEventVisibleTo(
  event: GameEvent,
  viewerId: PlayerId,
  state: GameState,
  visible: Set<HexKey>,
): boolean {
  if (event.type === 'PLAYER_ELIMINATED' || event.type === 'GAME_ENDED') return true
  if (event.playerId === viewerId) return true

  const coord = coordOf(event)
  if (coord) return visible.has(axialKey(coord))

  if (event.type === 'ATTACKED') {
    const defenderId = event.target as PlayerId
    if (defenderId === viewerId) return true
    const attackerPos = event.playerId ? state.units[event.playerId]?.pos : null
    const defenderPos = state.units[defenderId]?.pos
    return (!!attackerPos && visible.has(axialKey(attackerPos))) || (!!defenderPos && visible.has(axialKey(defenderPos)))
  }

  const actorPos = event.playerId ? state.units[event.playerId]?.pos : null
  return !!actorPos && visible.has(axialKey(actorPos))
}
