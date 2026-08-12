import type { PlayerMeta } from '../state/gameStore'
import { useOnlineGameStore } from '../state/onlineGameStore'
import { GameScreen } from './GameScreen'

export function OnlineGameScreen() {
  const state = useOnlineGameStore((s) => s.state)
  const seats = useOnlineGameStore((s) => s.players)
  const myPlayerId = useOnlineGameStore((s) => s.myPlayerId)
  const turnDeadline = useOnlineGameStore((s) => s.turnDeadline)
  const error = useOnlineGameStore((s) => s.error)
  const dispatch = useOnlineGameStore((s) => s.dispatch)
  const leave = useOnlineGameStore((s) => s.leave)

  if (!state || !myPlayerId) return null

  const players: PlayerMeta[] = seats.map((s) => ({ id: s.id, name: s.name, color: s.color }))

  return (
    <GameScreen
      state={state}
      players={players}
      myPlayerId={myPlayerId}
      error={error}
      dispatch={dispatch}
      onExit={leave}
      serverTurnDeadline={turnDeadline}
    />
  )
}
