import { create } from 'zustand'
import { applyCommand, createGame } from '../shared/reducer'
import type { Command, GameEvent, GameState, PlayerId } from '../shared/types'

export interface PlayerMeta {
  id: PlayerId
  name: string
  color: string
}

interface GameStoreState {
  state: GameState | null
  players: PlayerMeta[]
  eventLog: GameEvent[]
  error: string | null
  startGame: (players: PlayerMeta[], seed?: number) => void
  dispatch: (cmd: Command) => void
  reset: () => void
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  state: null,
  players: [],
  eventLog: [],
  error: null,

  startGame: (players, seed) => {
    const s = createGame(players.map((p) => p.id), seed ?? Date.now())
    set({ state: s, players, eventLog: [], error: null })
  },

  dispatch: (cmd) => {
    const { state } = get()
    if (!state) return
    const playerId = state.turnOrder[state.currentPlayerIndex]
    const result = applyCommand(state, playerId, cmd)
    if (!result.ok) {
      set({ error: result.error })
      return
    }
    set((prev) => ({
      state: result.state,
      eventLog: [...prev.eventLog, ...result.events].slice(-200),
      error: null,
    }))
  },

  reset: () => set({ state: null, players: [], eventLog: [], error: null }),
}))
