import type { GameState } from '../shared/types'
import type { PlayerMeta } from '../state/gameStore'

interface EndScreenProps {
  state: GameState
  players: PlayerMeta[]
  onRestart: () => void
}

export function EndScreen({ state, players, onRestart }: EndScreenProps) {
  const winner = players.find((p) => p.id === state.winner)

  return (
    <div className="end-screen">
      <h1>게임 종료</h1>
      {winner ? (
        <p className="end-winner" style={{ color: winner.color }}>
          {winner.name} 승리!
        </p>
      ) : (
        <p>승자 없음 (무승부)</p>
      )}
      <p>{state.round}라운드에 종료되었습니다.</p>

      <ul className="end-summary">
        {players.map((p) => {
          const baseCount = Object.values(state.bases).filter((owner) => owner === p.id).length
          return (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} /> {p.name} — 기지 {baseCount} · 가한
              피해 {state.damageDealt[p.id] ?? 0}
            </li>
          )
        })}
      </ul>

      <button onClick={onRestart}>다시 시작</button>
    </div>
  )
}
