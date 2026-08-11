import { resolveCombat } from './combat'
import { HEAL_PER_TURN, HP_MAX, MAX_ROUNDS, MOVE_POINTS, RESPAWN_DELAY, RESPAWN_HP_RATIO } from './config'
import { axialKey } from './hex'
import { generateMap } from './mapgen'
import { attackableTargets, basesOwnedBy, canFortify, moveCost, reachableTiles, tileAt, unitAt } from './rules'
import type { Command, GameEvent, GameState, PlayerId, Unit } from './types'

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string }

export function createGame(playerIds: PlayerId[], seed: number): GameState {
  const map = generateMap(seed, playerIds)
  const units: Record<PlayerId, Unit> = {}
  const damageDealt: Record<PlayerId, number> = {}

  for (const pid of playerIds) {
    units[pid] = {
      playerId: pid,
      pos: map.startPositions[pid],
      hp: HP_MAX,
      movesLeft: MOVE_POINTS,
      fortified: false,
      attackedThisTurn: false,
      alive: true,
      respawnIn: null,
    }
    damageDealt[pid] = 0
  }

  return {
    seed,
    round: 1,
    turnOrder: [...playerIds],
    currentPlayerIndex: 0,
    tiles: map.tiles,
    units,
    bases: { ...map.bases },
    eliminated: [],
    status: 'playing',
    winner: null,
    damageDealt,
  }
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    tiles: { ...state.tiles },
    units: Object.fromEntries(Object.entries(state.units).map(([k, u]) => [k, { ...u }])),
    bases: { ...state.bases },
    eliminated: [...state.eliminated],
    damageDealt: { ...state.damageDealt },
  }
}

function isCurrentPlayer(state: GameState, playerId: PlayerId): boolean {
  return state.turnOrder[state.currentPlayerIndex] === playerId
}

function checkElimination(state: GameState, events: GameEvent[]): void {
  for (const pid of state.turnOrder) {
    if (state.eliminated.includes(pid)) continue
    if (basesOwnedBy(state, pid).length === 0) {
      state.eliminated.push(pid)
      const unit = state.units[pid]
      unit.alive = false
      unit.pos = null
      unit.respawnIn = null
      events.push({ type: 'PLAYER_ELIMINATED', playerId: pid })
    }
  }
}

function checkWin(state: GameState, events: GameEvent[]): void {
  const active = state.turnOrder.filter((pid) => !state.eliminated.includes(pid))
  if (active.length <= 1) {
    state.status = 'finished'
    state.winner = active[0] ?? null
    events.push({ type: 'GAME_ENDED', playerId: state.winner ?? undefined })
  }
}

function pickRoundLimitWinner(state: GameState): PlayerId | null {
  const active = state.turnOrder.filter((pid) => !state.eliminated.includes(pid))
  if (active.length === 0) return null
  return [...active].sort((a, b) => {
    const baseDiff = basesOwnedBy(state, b).length - basesOwnedBy(state, a).length
    if (baseDiff !== 0) return baseDiff
    return state.damageDealt[b] - state.damageDealt[a]
  })[0]
}

/** 다음 살아있는 플레이어의 턴으로 넘긴다. 탈락자는 건너뛰고, 죽었지만 탈락하지 않은 플레이어는 부활 카운트다운만 진행한다. */
function advanceTurn(state: GameState, events: GameEvent[]): void {
  const n = state.turnOrder.length
  let idx = state.currentPlayerIndex
  let steps = 0
  do {
    idx = (idx + 1) % n
    if (idx === 0) state.round += 1
    steps += 1
  } while (state.eliminated.includes(state.turnOrder[idx]) && steps <= n)

  state.currentPlayerIndex = idx
  const next = state.units[state.turnOrder[idx]]
  if (next.alive) {
    next.movesLeft = MOVE_POINTS
    next.attackedThisTurn = false
  } else if (next.respawnIn !== null && next.respawnIn > 0) {
    next.respawnIn -= 1
  }

  if (state.status === 'playing' && state.round > MAX_ROUNDS) {
    state.status = 'finished'
    state.winner = pickRoundLimitWinner(state)
    events.push({ type: 'GAME_ENDED', playerId: state.winner ?? undefined })
  }
}

function healIfEligible(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const unit = state.units[playerId]
  if (!unit.alive || !unit.pos) return
  const k = axialKey(unit.pos)
  if (state.bases[k] === playerId && !unit.attackedThisTurn && unit.hp < HP_MAX) {
    const healed = Math.min(HP_MAX, unit.hp + HEAL_PER_TURN) - unit.hp
    unit.hp += healed
    if (healed > 0) events.push({ type: 'HEALED', playerId, amount: healed })
  }
}

export function applyCommand(state: GameState, playerId: PlayerId, cmd: Command): CommandResult {
  if (state.status !== 'playing') return { ok: false, error: 'GAME_NOT_ACTIVE' }
  if (!isCurrentPlayer(state, playerId)) return { ok: false, error: 'NOT_YOUR_TURN' }

  const next = cloneState(state)
  const events: GameEvent[] = []
  const unit = next.units[playerId]

  switch (cmd.type) {
    case 'MOVE': {
      if (!unit.alive || !unit.pos) return { ok: false, error: 'NO_UNIT' }
      const reachable = reachableTiles(next, playerId)
      const destKey = axialKey(cmd.to)
      if (!reachable.has(destKey)) return { ok: false, error: 'ILLEGAL_MOVE' }

      const destTile = tileAt(next, cmd.to)!
      unit.movesLeft = Math.max(0, unit.movesLeft - moveCost(destTile.terrain))
      unit.pos = cmd.to
      unit.fortified = false
      events.push({ type: 'MOVED', playerId, to: cmd.to })

      const baseOwner = next.bases[destKey]
      if (baseOwner && baseOwner !== playerId) {
        next.bases[destKey] = playerId
        events.push({ type: 'CAPTURED_BASE', playerId, at: cmd.to, from: baseOwner })
        checkElimination(next, events)
        checkWin(next, events)
      }
      return { ok: true, state: next, events }
    }

    case 'ATTACK': {
      if (!unit.alive || !unit.pos) return { ok: false, error: 'NO_UNIT' }
      const targets = attackableTargets(next, playerId)
      if (!targets.some((t) => axialKey(t) === axialKey(cmd.target))) {
        return { ok: false, error: 'ILLEGAL_ATTACK' }
      }

      const defender = unitAt(next, cmd.target)!
      const defenderTile = tileAt(next, cmd.target)!
      const result = resolveCombat({
        attackerHp: unit.hp,
        defenderHp: defender.hp,
        defenderTerrain: defenderTile.terrain,
        defenderOnOwnBase: next.bases[axialKey(cmd.target)] === defender.playerId,
        defenderFortified: defender.fortified,
      })

      unit.hp = result.attackerHpAfter
      defender.hp = result.defenderHpAfter
      unit.attackedThisTurn = true
      unit.movesLeft = 0
      next.damageDealt[playerId] += result.defenderDamage
      next.damageDealt[defender.playerId] += result.attackerDamage

      events.push({
        type: 'ATTACKED',
        playerId,
        target: defender.playerId,
        attackerDamage: result.attackerDamage,
        defenderDamage: result.defenderDamage,
      })

      if (unit.hp <= 0) {
        unit.alive = false
        unit.pos = null
        unit.respawnIn = RESPAWN_DELAY
        events.push({ type: 'UNIT_DIED', playerId })
      }
      if (defender.hp <= 0) {
        defender.alive = false
        defender.pos = null
        defender.respawnIn = RESPAWN_DELAY
        events.push({ type: 'UNIT_DIED', playerId: defender.playerId })
      }

      checkElimination(next, events)
      checkWin(next, events)
      if (next.status === 'playing') advanceTurn(next, events)
      return { ok: true, state: next, events }
    }

    case 'FORTIFY': {
      if (!canFortify(next, playerId)) return { ok: false, error: 'CANNOT_FORTIFY' }
      unit.fortified = true
      unit.movesLeft = 0
      events.push({ type: 'FORTIFIED', playerId })
      advanceTurn(next, events)
      return { ok: true, state: next, events }
    }

    case 'CHOOSE_RESPAWN': {
      if (unit.alive || unit.respawnIn !== 0) return { ok: false, error: 'CANNOT_RESPAWN' }
      const owned = basesOwnedBy(next, playerId)
      if (!owned.includes(axialKey(cmd.at))) return { ok: false, error: 'ILLEGAL_RESPAWN' }

      unit.alive = true
      unit.pos = cmd.at
      unit.hp = Math.round(HP_MAX * RESPAWN_HP_RATIO)
      unit.movesLeft = MOVE_POINTS
      unit.fortified = false
      unit.attackedThisTurn = false
      unit.respawnIn = null
      events.push({ type: 'UNIT_RESPAWNED', playerId, at: cmd.at })
      advanceTurn(next, events)
      return { ok: true, state: next, events }
    }

    case 'END_TURN': {
      healIfEligible(next, playerId, events)
      advanceTurn(next, events)
      return { ok: true, state: next, events }
    }

    default:
      return { ok: false, error: 'UNKNOWN_COMMAND' }
  }
}
