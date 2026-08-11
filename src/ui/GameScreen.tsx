import { useEffect, useMemo, useState } from 'react'
import { TURN_SECONDS } from '../shared/config'
import { axialKey } from '../shared/hex'
import { attackableTargets, basesOwnedBy, canFortify, reachableTiles } from '../shared/rules'
import type { AxialCoord } from '../shared/types'
import { HexBoard } from '../render/HexBoard'
import { useGameStore } from '../state/gameStore'
import { EndScreen } from './EndScreen'

export function GameScreen() {
  const state = useGameStore((s) => s.state)
  const players = useGameStore((s) => s.players)
  const dispatch = useGameStore((s) => s.dispatch)
  const error = useGameStore((s) => s.error)
  const reset = useGameStore((s) => s.reset)

  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS)

  const turnKey = state ? `${state.round}-${state.currentPlayerIndex}` : ''

  useEffect(() => {
    setSecondsLeft(TURN_SECONDS)
  }, [turnKey])

  useEffect(() => {
    if (!state || state.status !== 'playing') return
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          dispatch({ type: 'END_TURN' })
          return TURN_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, state?.status])

  const currentPlayerId = state?.turnOrder[state.currentPlayerIndex]
  const unit = currentPlayerId ? state?.units[currentPlayerId] : undefined

  const reachable = useMemo(() => {
    if (!state || !currentPlayerId) return new Map<string, number>()
    return reachableTiles(state, currentPlayerId)
  }, [state, currentPlayerId])

  const attackable = useMemo(() => {
    if (!state || !currentPlayerId) return [] as AxialCoord[]
    return attackableTargets(state, currentPlayerId)
  }, [state, currentPlayerId])

  const attackableKeys = useMemo(() => new Set(attackable.map(axialKey)), [attackable])
  const reachableKeys = useMemo(() => new Set(reachable.keys()), [reachable])

  const ownedBaseKeys = useMemo(() => {
    if (!state || !currentPlayerId) return [] as string[]
    return basesOwnedBy(state, currentPlayerId)
  }, [state, currentPlayerId])

  if (!state || !currentPlayerId || !unit) return null

  if (state.status === 'finished') {
    return <EndScreen state={state} players={players} onRestart={reset} />
  }

  const currentPlayer = players.find((p) => p.id === currentPlayerId)!
  const isDead = !unit.alive
  const awaitingRespawn = isDead && unit.respawnIn === 0

  const handleTileClick = (coord: AxialCoord) => {
    const k = axialKey(coord)
    if (awaitingRespawn) {
      if (ownedBaseKeys.includes(k)) dispatch({ type: 'CHOOSE_RESPAWN', at: coord })
      return
    }
    if (attackableKeys.has(k)) {
      dispatch({ type: 'ATTACK', target: coord })
      return
    }
    if (reachableKeys.has(k)) {
      dispatch({ type: 'MOVE', to: coord })
    }
  }

  return (
    <div className="game-screen">
      <div className="game-board-wrap">
        <HexBoard
          state={state}
          players={players}
          reachable={awaitingRespawn ? new Set(ownedBaseKeys) : reachableKeys}
          attackable={attackableKeys}
          onTileClick={handleTileClick}
        />
      </div>
      <aside className="side-panel">
        <h2 style={{ color: currentPlayer.color }}>{currentPlayer.name}의 턴</h2>
        <p className="round-timer">
          라운드 {state.round} / 60 · 남은 시간 {secondsLeft}s
        </p>
        {error && <p className="error-banner">{error}</p>}

        {isDead ? (
          <p className="respawn-notice">
            {awaitingRespawn
              ? '소유 기지 타일을 클릭해 부활하세요.'
              : `부활까지 ${unit.respawnIn}턴 남음 (턴 종료를 눌러 진행)`}
          </p>
        ) : (
          <>
            <p>
              HP {unit.hp} · 이동력 {unit.movesLeft}
              {unit.fortified ? ' · 주둔 중' : ''}
            </p>
            <div className="action-buttons">
              <button disabled={!canFortify(state, currentPlayerId)} onClick={() => dispatch({ type: 'FORTIFY' })}>
                주둔 (방어 +20%)
              </button>
              <button onClick={() => dispatch({ type: 'END_TURN' })}>턴 종료</button>
            </div>
          </>
        )}

        {isDead && (
          <button className="end-turn-fallback" onClick={() => dispatch({ type: 'END_TURN' })}>
            턴 종료
          </button>
        )}

        <ScoreBoard state={state} players={players} />
      </aside>
    </div>
  )
}

function ScoreBoard({
  state,
  players,
}: {
  state: import('../shared/types').GameState
  players: { id: string; name: string; color: string }[]
}) {
  return (
    <ul className="scoreboard">
      {players.map((p) => {
        const baseCount = Object.values(state.bases).filter((owner) => owner === p.id).length
        const eliminated = state.eliminated.includes(p.id)
        return (
          <li key={p.id} className={eliminated ? 'scoreboard-row--eliminated' : ''}>
            <span className="dot" style={{ background: p.color }} /> {p.name} — 기지 {baseCount}
            {eliminated ? ' (탈락)' : ''}
          </li>
        )
      })}
    </ul>
  )
}
