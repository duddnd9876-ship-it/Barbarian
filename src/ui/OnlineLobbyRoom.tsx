import { MIN_PLAYERS } from '../shared/config'
import { useOnlineGameStore } from '../state/onlineGameStore'

export function OnlineLobbyRoom() {
  const roomCode = useOnlineGameStore((s) => s.roomCode)
  const players = useOnlineGameStore((s) => s.players)
  const hostId = useOnlineGameStore((s) => s.hostId)
  const myPlayerId = useOnlineGameStore((s) => s.myPlayerId)
  const error = useOnlineGameStore((s) => s.error)
  const start = useOnlineGameStore((s) => s.start)
  const leave = useOnlineGameStore((s) => s.leave)

  const isHost = myPlayerId === hostId
  const canStart = players.length >= MIN_PLAYERS

  return (
    <div className="lobby">
      <h1>대기실</h1>
      <p className="room-code-display">
        방 코드: <strong>{roomCode}</strong>
      </p>
      <p className="lobby-desc">이 코드를 상대에게 알려주면 같은 방에 들어올 수 있습니다. ({MIN_PLAYERS}~6인)</p>

      {error && <p className="error-banner">{error}</p>}

      <ul className="scoreboard">
        {players.map((p) => (
          <li key={p.id}>
            <span className="dot" style={{ background: p.color }} /> {p.name}
            {p.id === hostId ? ' (방장)' : ''}
            {!p.connected ? ' · 연결 끊김' : ''}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button className="lobby-start" disabled={!canStart} onClick={start}>
          게임 시작{canStart ? '' : ` (${MIN_PLAYERS}인 이상 필요)`}
        </button>
      ) : (
        <p>방장이 게임을 시작하면 자동으로 시작됩니다.</p>
      )}

      <button className="end-turn-fallback" onClick={leave}>
        나가기
      </button>
    </div>
  )
}
