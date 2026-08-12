import { create } from 'zustand'
import type { ClientMessage, PublicSeat, ServerMessage } from '../net/protocol'
import type { Command, GameState, PlayerId } from '../shared/types'

export type RoomStatus = 'disconnected' | 'connecting' | 'lobby' | 'playing' | 'finished'

interface OnlineGameStore {
  roomStatus: RoomStatus
  roomCode: string | null
  myPlayerId: PlayerId | null
  hostId: PlayerId | null
  players: PublicSeat[]
  state: GameState | null
  turnDeadline: number | null
  error: string | null

  createRoom: (name: string) => Promise<void>
  joinRoom: (roomCode: string, name: string) => void
  start: () => void
  dispatch: (cmd: Command) => void
  leave: () => void
}

let socket: WebSocket | null = null

function tokenStorageKey(roomCode: string): string {
  return `hex-claim:token:${roomCode}`
}

function wsUrl(roomCode: string, name: string, token?: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const params = new URLSearchParams({ name })
  if (token) params.set('token', token)
  return `${proto}://${location.host}/ws/${roomCode}?${params.toString()}`
}

function send(message: ClientMessage): void {
  socket?.send(JSON.stringify(message))
}

function statusToRoomStatus(status: GameState['status'] | 'lobby' | 'playing' | 'finished'): RoomStatus {
  return status
}

export const useOnlineGameStore = create<OnlineGameStore>((set, get) => ({
  roomStatus: 'disconnected',
  roomCode: null,
  myPlayerId: null,
  hostId: null,
  players: [],
  state: null,
  turnDeadline: null,
  error: null,

  createRoom: async (name) => {
    set({ roomStatus: 'connecting', error: null })
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (!res.ok) throw new Error('ROOM_CREATE_FAILED')
      const body = (await res.json()) as { roomCode: string }
      get().joinRoom(body.roomCode, name)
    } catch {
      set({ roomStatus: 'disconnected', error: 'ROOM_CREATE_FAILED' })
    }
  },

  joinRoom: (roomCode, name) => {
    const code = roomCode.trim().toUpperCase()
    socket?.close()
    set({ roomStatus: 'connecting', roomCode: code, error: null, state: null })

    const token = localStorage.getItem(tokenStorageKey(code)) ?? undefined
    const ws = new WebSocket(wsUrl(code, name, token))
    socket = ws

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage
      applyServerMessage(message, code)
    })
    ws.addEventListener('close', () => {
      if (get().roomStatus !== 'disconnected') {
        set({ roomStatus: 'disconnected', error: '서버와의 연결이 끊어졌습니다.' })
      }
    })
    ws.addEventListener('error', () => {
      set({ error: '연결에 실패했습니다.' })
    })
  },

  start: () => send({ type: 'START' }),

  dispatch: (cmd) => send({ type: 'COMMAND', command: cmd }),

  leave: () => {
    socket?.close()
    socket = null
    set({
      roomStatus: 'disconnected',
      roomCode: null,
      myPlayerId: null,
      hostId: null,
      players: [],
      state: null,
      turnDeadline: null,
      error: null,
    })
  },
}))

function applyServerMessage(message: ServerMessage, roomCode: string): void {
  const set = useOnlineGameStore.setState

  switch (message.type) {
    case 'JOINED':
      localStorage.setItem(tokenStorageKey(roomCode), message.token)
      set({
        myPlayerId: message.playerId,
        hostId: message.hostId,
        players: message.players,
        roomStatus: statusToRoomStatus(message.status),
      })
      break
    case 'ROSTER':
      set({ players: message.players, hostId: message.hostId, roomStatus: statusToRoomStatus(message.status) })
      break
    case 'SNAPSHOT':
      set({
        state: message.state,
        turnDeadline: message.turnDeadline,
        roomStatus: statusToRoomStatus(message.state.status),
      })
      break
    case 'EVENTS':
      break
    case 'ERROR':
      set({ error: message.message })
      break
  }
}
