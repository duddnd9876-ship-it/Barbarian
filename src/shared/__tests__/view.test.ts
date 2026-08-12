import { describe, expect, it } from 'vitest'
import { applyFogOfWar, computeVisibleHexes, isEventVisibleTo } from '../view'
import type { GameState, Tile, Unit } from '../types'

function makeState(overrides?: { p1Pos?: { q: number; r: number } | null; p2Pos?: { q: number; r: number } | null }): GameState {
  const coords: { q: number; r: number }[] = []
  for (let q = -6; q <= 6; q++) {
    for (let r = -6; r <= 6; r++) {
      if (Math.abs(q + r) <= 6) coords.push({ q, r })
    }
  }
  const tiles: Record<string, Tile> = {}
  for (const c of coords) tiles[`${c.q},${c.r}`] = { coord: c, terrain: 'plains' }
  tiles['0,0'].baseOwner = 'p1'

  const p1Pos = overrides && 'p1Pos' in overrides ? overrides.p1Pos! : { q: 0, r: 0 }
  const p2Pos = overrides && 'p2Pos' in overrides ? overrides.p2Pos! : { q: 5, r: 0 }

  const makeUnit = (playerId: string, pos: { q: number; r: number } | null): Unit => ({
    playerId,
    pos,
    hp: 100,
    movesLeft: 2,
    fortified: false,
    attackedThisTurn: false,
    alive: pos !== null,
    respawnIn: pos === null ? 0 : null,
  })

  return {
    seed: 1,
    round: 1,
    turnOrder: ['p1', 'p2'],
    currentPlayerIndex: 0,
    tiles,
    units: { p1: makeUnit('p1', p1Pos), p2: makeUnit('p2', p2Pos) },
    bases: { '0,0': 'p1' },
    eliminated: [],
    status: 'playing',
    winner: null,
    damageDealt: { p1: 0, p2: 0 },
  }
}

describe('computeVisibleHexes', () => {
  it("includes the player's own unit vision radius (2) and base vision radius (3)", () => {
    const state = makeState()
    const visible = computeVisibleHexes(state, 'p1')
    expect(visible.has('2,0')).toBe(true) // 유닛 시야(2) 안
    expect(visible.has('3,0')).toBe(true) // 기지 시야(3) 안 (유닛 시야 밖이어도)
    expect(visible.has('4,0')).toBe(false) // 둘 다 밖
  })
})

describe('applyFogOfWar', () => {
  it('시야 밖 적 유닛은 좌표가 사라진다 (alive는 그대로 유지)', () => {
    const state = makeState({ p2Pos: { q: 5, r: 0 } }) // p1(0,0) 기준 거리 5, 시야(최대3) 밖
    const fogged = applyFogOfWar(state, 'p1')
    expect(fogged.units.p2.pos).toBeNull()
    expect(fogged.units.p2.alive).toBe(true) // 죽었다고 속이지는 않는다
  })

  it('시야 안 적 유닛은 그대로 보인다', () => {
    const state = makeState({ p2Pos: { q: 2, r: 0 } }) // p1 유닛 시야(2) 안
    const fogged = applyFogOfWar(state, 'p1')
    expect(fogged.units.p2.pos).toEqual({ q: 2, r: 0 })
  })

  it('자기 유닛은 항상 그대로 보인다', () => {
    const state = makeState()
    const fogged = applyFogOfWar(state, 'p1')
    expect(fogged.units.p1.pos).toEqual({ q: 0, r: 0 })
  })

  it('지형과 기지 소유권은 안개의 영향을 받지 않는다', () => {
    const state = makeState({ p2Pos: { q: 5, r: 0 } })
    const fogged = applyFogOfWar(state, 'p1')
    expect(fogged.tiles).toBe(state.tiles)
    expect(fogged.bases).toBe(state.bases)
  })
})

describe('isEventVisibleTo', () => {
  const state = makeState({ p2Pos: { q: 5, r: 0 } })
  const visible = computeVisibleHexes(state, 'p1')

  it('좌표가 시야 밖인 이벤트는 숨긴다', () => {
    const event = { type: 'MOVED' as const, playerId: 'p2', to: { q: 5, r: 0 } }
    expect(isEventVisibleTo(event, 'p1', state, visible)).toBe(false)
  })

  it('좌표가 시야 안인 이벤트는 보여준다', () => {
    const event = { type: 'MOVED' as const, playerId: 'p2', to: { q: 1, r: 0 } }
    expect(isEventVisibleTo(event, 'p1', state, visible)).toBe(true)
  })

  it('행위자가 자기 자신인 이벤트는 항상 보여준다', () => {
    const event = { type: 'MOVED' as const, playerId: 'p1', to: { q: 5, r: 0 } }
    expect(isEventVisibleTo(event, 'p1', state, visible)).toBe(true)
  })

  it('PLAYER_ELIMINATED / GAME_ENDED는 항상 공개된다', () => {
    expect(isEventVisibleTo({ type: 'PLAYER_ELIMINATED', playerId: 'p2' }, 'p1', state, visible)).toBe(true)
    expect(isEventVisibleTo({ type: 'GAME_ENDED', playerId: 'p2' }, 'p1', state, visible)).toBe(true)
  })

  it('ATTACKED는 당사자에게는 항상 보이고, 관계없는 3자에게는 위치 기준으로 걸러진다', () => {
    const event = { type: 'ATTACKED' as const, playerId: 'p2', target: 'p1', attackerDamage: 10, defenderDamage: 10 }
    expect(isEventVisibleTo(event, 'p1', state, visible)).toBe(true) // 방어자 본인
  })
})
