import { GameScreen } from './ui/GameScreen'
import { Lobby } from './ui/Lobby'
import { useGameStore } from './state/gameStore'

export default function App() {
  const state = useGameStore((s) => s.state)

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Hex Claim</span>
        <span className="firebase-badge">로컬 핫싯 모드 · 온라인 대전은 파이어베이스 연동 예정</span>
      </header>
      {state ? <GameScreen /> : <Lobby />}
    </div>
  )
}
