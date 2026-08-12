import { useGameStore } from '../state/gameStore'
import { GameScreen } from './GameScreen'

export function LocalGameScreen() {
  const state = useGameStore((s) => s.state)
  const players = useGameStore((s) => s.players)
  const dispatch = useGameStore((s) => s.dispatch)
  const error = useGameStore((s) => s.error)
  const reset = useGameStore((s) => s.reset)

  if (!state) return null

  const myPlayerId = state.turnOrder[state.currentPlayerIndex]

  return <GameScreen state={state} players={players} myPlayerId={myPlayerId} error={error} dispatch={dispatch} onExit={reset} />
}
