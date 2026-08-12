import { useEffect, useMemo, useState } from 'react'
import { TURN_SECONDS } from '../shared/config'
import { axialKey } from '../shared/hex'
import { attackableTargets, basesOwnedBy, canFortify, reachableTiles } from '../shared/rules'
import type { AxialCoord, Command, GameState, PlayerId } from '../shared/types'
import { HexBoard } from '../render/HexBoard'
import type { PlayerMeta } from '../state/gameStore'
import { EndScreen } from './EndScreen'

export interface GameScreenProps {
  state: GameState
  players: PlayerMeta[]
  /** 이 화면을 보고 있는 사람이 조작할 수 있는 플레이어 id. 로컬 핫싯에서는 항상 "현재 턴 플레이어"와 같다. */
  myPlayerId: PlayerId
  error: string | null
  dispatch: (cmd: Command) => void
  onExit: () => void
  /**
   * 지정하면(undefined가 아니면) 서버가 턴 타이머를 관리한다는 뜻 — 화면은 카운트다운만 보여주고
   * 스스로 END_TURN을 보내지 않는다. 로컬 핫싯은 이 값을 넘기지 않아 기존처럼 클라이언트가 직접 타이머를 돈다.
   */
  serverTurnDeadline?: number | null
}

export function GameScreen({ state, players, myPlayerId, error, dispatch, onExit, serverTurnDeadline }: GameScreenProps) {
  const isOnline = serverTurnDeadline !== undefined
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex]
  const isMyTurn = myPlayerId === currentPlayerId

  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS)
  const turnKey = `${state.round}-${state.currentPlayerIndex}`

  useEffect(() => {
    setSecondsLeft(TURN_SECONDS)
  }, [turnKey])

  // 로컬 핫싯: 클라이언트가 45초를 직접 세고 만료되면 END_TURN을 보낸다.
  useEffect(() => {
    if (isOnline || state.status !== 'playing') return
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
  }, [turnKey, state.status, isOnline])

  // 온라인: 서버가 준 마감 시각까지 남은 시간을 표시만 한다 (실제 턴 종료는 서버 알람이 처리).
  useEffect(() => {
    if (!isOnline || serverTurnDeadline == null) return
    const tick = () => setSecondsLeft(Math.max(0, Math.round((serverTurnDeadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isOnline, serverTurnDeadline])

  const unit = state.units[currentPlayerId]

  const reachable = useMemo(() => {
    if (!isMyTurn) return new Map<string, number>()
    return reachableTiles(state, currentPlayerId)
  }, [state, currentPlayerId, isMyTurn])

  const attackable = useMemo(() => {
    if (!isMyTurn) return [] as AxialCoord[]
    return attackableTargets(state, currentPlayerId)
  }, [state, currentPlayerId, isMyTurn])

  const attackableKeys = useMemo(() => new Set(attackable.map(axialKey)), [attackable])
  const reachableKeys = useMemo(() => new Set(reachable.keys()), [reachable])

  const ownedBaseKeys = useMemo(() => {
    if (!isMyTurn) return [] as string[]
    return basesOwnedBy(state, currentPlayerId)
  }, [state, currentPlayerId, isMyTurn])

  if (state.status === 'finished') {
    return <EndScreen state={state} players={players} onRestart={onExit} />
  }

  const currentPlayer = players.find((p) => p.id === currentPlayerId)!
  const isDead = !unit.alive
  const awaitingRespawn = isDead && unit.respawnIn === 0

  const handleTileClick = (coord: AxialCoord) => {
    if (!isMyTurn) return
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

        {!isMyTurn ? (
          <p className="spectate-notice">상대의 턴입니다. 잠시 기다려주세요.</p>
        ) : isDead ? (
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

        {isMyTurn && isDead && (
          <button className="end-turn-fallback" onClick={() => dispatch({ type: 'END_TURN' })}>
            턴 종료
          </button>
        )}

        <ScoreBoard state={state} players={players} />

        <button className="leave-button" onClick={onExit}>
          나가기
        </button>
      </aside>
    </div>
  )
}

function ScoreBoard({ state, players }: { state: GameState; players: PlayerMeta[] }) {
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
