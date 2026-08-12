import { LocalGameScreen } from './ui/LocalGameScreen'
import { Lobby } from './ui/Lobby'
import { OnlineGameScreen } from './ui/OnlineGameScreen'
import { OnlineLobbyRoom } from './ui/OnlineLobbyRoom'
import { useGameStore } from './state/gameStore'
import { useOnlineGameStore } from './state/onlineGameStore'

export default function App() {
  const localState = useGameStore((s) => s.state)
  const roomStatus = useOnlineGameStore((s) => s.roomStatus)

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Hex Claim</span>
        <span className="firebase-badge">로컬 핫싯 · 온라인 대전 (Cloudflare Workers + Durable Objects)</span>
      </header>
      {renderBody(localState, roomStatus)}
    </div>
  )
}

function renderBody(localState: ReturnType<typeof useGameStore.getState>['state'], roomStatus: string) {
  if (localState) return <LocalGameScreen />
  if (roomStatus === 'connecting') {
    return (
      <div className="lobby">
        <p>연결 중…</p>
      </div>
    )
  }
  if (roomStatus === 'lobby') return <OnlineLobbyRoom />
  if (roomStatus === 'playing' || roomStatus === 'finished') return <OnlineGameScreen />
  return <Lobby />
}
