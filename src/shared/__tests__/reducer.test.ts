import { describe, expect, it } from 'vitest'
import { applyCommand } from '../reducer'
import { reachableTiles } from '../rules'
import type { GameState, Tile, Unit } from '../types'

/**
 * 맵 생성에 의존하지 않는, 손으로 만든 최소 상태.
 * (0,0)=p1 기지, (1,0)=평지, (2,0)=p2 기지. 세 칸이 일직선.
 */
function makeTinyState(overrides?: {
  p1Pos?: { q: number; r: number } | null
  p2Pos?: { q: number; r: number } | null
  p1Hp?: number
  p2Hp?: number
}): GameState {
  const coords = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ]
  const tiles: Record<string, Tile> = {}
  for (const c of coords) {
    tiles[`${c.q},${c.r}`] = { coord: c, terrain: 'plains' }
  }
  tiles['0,0'].baseOwner = 'p1'
  tiles['2,0'].baseOwner = 'p2'

  // `??`는 명시적 null도 "값 없음"으로 취급해 기본값으로 되돌리므로, 오버라이드가
  // 실제로 주어졌는지는 `in` 연산자로 구분해야 한다 (null로 유닛을 없앨 수 있어야 함).
  const pick = (key: 'p1Pos' | 'p2Pos', fallback: { q: number; r: number }) =>
    overrides && key in overrides ? (overrides[key] as { q: number; r: number } | null) : fallback

  const p1Pos = pick('p1Pos', { q: 0, r: 0 })
  const p2Pos = pick('p2Pos', { q: 2, r: 0 })

  const makeUnit = (playerId: string, pos: { q: number; r: number } | null, hp: number): Unit => ({
    playerId,
    pos,
    hp,
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
    units: {
      p1: makeUnit('p1', p1Pos, overrides?.p1Hp ?? 100),
      p2: makeUnit('p2', p2Pos, overrides?.p2Hp ?? 100),
    },
    bases: { '0,0': 'p1', '2,0': 'p2' },
    eliminated: [],
    status: 'playing',
    winner: null,
    damageDealt: { p1: 0, p2: 0 },
  }
}

describe('applyCommand: 기본 검증', () => {
  it('현재 턴이 아닌 플레이어의 명령은 거절하고 상태를 바꾸지 않는다', () => {
    const state = makeTinyState()
    const result = applyCommand(state, 'p2', { type: 'END_TURN' })
    expect(result.ok).toBe(false)
    expect(state.currentPlayerIndex).toBe(0)
  })

  it('적 유닛이 있는 타일로는 이동할 수 없다 (공격으로만 접근 가능)', () => {
    const state = makeTinyState()
    const result = applyCommand(state, 'p1', { type: 'MOVE', to: { q: 2, r: 0 } })
    // p1(0,0)->p2 기지(2,0)는 거리 2, 평지 비용 1이라 이동력 2로 도달 가능하지만
    // 목적지에 적 유닛이 있으므로 이동으로는 불가하다.
    expect(result.ok).toBe(false)
  })
})

describe('applyCommand: MOVE', () => {
  it('인접한 빈 평지로 이동하면 이동력이 소모되고 턴은 유지된다', () => {
    const state = makeTinyState()
    const result = applyCommand(state, 'p1', { type: 'MOVE', to: { q: 1, r: 0 } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.units.p1.pos).toEqual({ q: 1, r: 0 })
    expect(result.state.units.p1.movesLeft).toBe(1)
    expect(result.state.currentPlayerIndex).toBe(0) // 턴 안 넘어감
  })

  it('점령하려는 기지에 방어 유닛이 있으면 이동으로 들어갈 수 없다', () => {
    const state = makeTinyState({ p2Pos: { q: 1, r: 0 } }) // p2 유닛이 자기 기지를 비우고 중간에 서 있음
    const result = applyCommand(state, 'p1', { type: 'MOVE', to: { q: 1, r: 0 } })
    expect(result.ok).toBe(false) // (1,0)에 p2 유닛이 있으므로 이동 불가(공격 대상)
  })

  it('방어 유닛 없는 적 기지에 진입하면 즉시 점령하고, 기지가 하나뿐이던 상대는 탈락+승리 처리된다', () => {
    const openBaseState = makeTinyState({ p2Pos: null }) // p2 유닛이 죽어 자리를 비운 상태
    const result = applyCommand(openBaseState, 'p1', { type: 'MOVE', to: { q: 2, r: 0 } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.bases['2,0']).toBe('p1')
    expect(result.state.eliminated).toContain('p2')
    expect(result.state.status).toBe('finished')
    expect(result.state.winner).toBe('p1')
  })
})

describe('applyCommand: ATTACK', () => {
  it('인접한 적을 공격하면 양쪽이 동시에 피해를 입고(방어자 기지 보너스 반영) 턴이 넘어간다', () => {
    // p2는 자신의 기지(2,0) 위에서 방어하므로 +25% 기지 보너스가 붙는다.
    // (순수 평지 vs 평지 24/24 골든값은 combat.test.ts에서 별도로 검증한다.)
    const state = makeTinyState({ p1Pos: { q: 1, r: 0 }, p2Pos: { q: 2, r: 0 } })
    const result = applyCommand(state, 'p1', { type: 'ATTACK', target: { q: 2, r: 0 } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.units.p1.hp).toBe(66) // 100 - 34 (공격자 피해)
    expect(result.state.units.p2.hp).toBe(83) // 100 - 17 (기지 방어 보너스로 피해 감소)
    expect(result.state.currentPlayerIndex).toBe(1) // p2 턴으로 넘어감
  })

  it('공격으로 방어자가 죽어도 공격자는 그 자리에 머문다', () => {
    const state = makeTinyState({ p1Pos: { q: 1, r: 0 }, p2Pos: { q: 2, r: 0 }, p2Hp: 10 })
    const result = applyCommand(state, 'p1', { type: 'ATTACK', target: { q: 2, r: 0 } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.units.p2.hp).toBe(0)
    expect(result.state.units.p2.alive).toBe(false)
    expect(result.state.units.p1.pos).toEqual({ q: 1, r: 0 }) // 전진하지 않음
  })
})

describe('applyCommand: END_TURN / 회복', () => {
  it('자기 기지 위에서 공격 없이 턴을 마치면 25 회복한다', () => {
    const state = makeTinyState({ p1Hp: 50 })
    const result = applyCommand(state, 'p1', { type: 'END_TURN' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.units.p1.hp).toBe(75)
  })

  it('기지 밖에서는 회복하지 않는다', () => {
    const state = makeTinyState({ p1Pos: { q: 1, r: 0 }, p1Hp: 50 })
    const result = applyCommand(state, 'p1', { type: 'END_TURN' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.units.p1.hp).toBe(50)
  })
})

describe('reachableTiles: 이동력 규칙', () => {
  it('이동력이 1 이상 남아있으면 비용이 더 큰 타일도 진입할 수 있다', () => {
    const coords = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]
    const tiles: Record<string, Tile> = {}
    tiles['0,0'] = { coord: coords[0], terrain: 'plains' }
    tiles['1,0'] = { coord: coords[1], terrain: 'rough' }
    tiles['2,0'] = { coord: coords[2], terrain: 'plains' }

    const state: GameState = {
      seed: 1,
      round: 1,
      turnOrder: ['p1'],
      currentPlayerIndex: 0,
      tiles,
      units: {
        p1: {
          playerId: 'p1',
          pos: coords[0],
          hp: 100,
          movesLeft: 2,
          fortified: false,
          attackedThisTurn: false,
          alive: true,
          respawnIn: null,
        },
      },
      bases: {},
      eliminated: [],
      status: 'playing',
      winner: null,
      damageDealt: { p1: 0 },
    }

    const reachable = reachableTiles(state, 'p1')
    expect(reachable.get('1,0')).toBe(0) // 험지 진입에 이동력 2 전부 소모
    expect(reachable.has('2,0')).toBe(false) // 험지에서 남은 이동력 0이라 더 못 감
  })
})
