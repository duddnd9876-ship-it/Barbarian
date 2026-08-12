import { z } from 'zod'
import type { GameEvent, GameState, GameStatus, PlayerId } from '../src/shared/types'

const AxialCoordSchema = z.object({ q: z.number().int(), r: z.number().int() })

const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOVE'), to: AxialCoordSchema }),
  z.object({ type: z.literal('ATTACK'), target: AxialCoordSchema }),
  z.object({ type: z.literal('FORTIFY') }),
  z.object({ type: z.literal('END_TURN') }),
  z.object({ type: z.literal('CHOOSE_RESPAWN'), at: AxialCoordSchema }),
])

const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('COMMAND'), command: CommandSchema }),
])

export type ClientMessage = z.infer<typeof ClientMessageSchema>

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw))
}

export interface PublicSeat {
  id: PlayerId
  name: string
  color: string
  connected: boolean
}

export type ServerMessage =
  | {
      type: 'JOINED'
      playerId: PlayerId
      token: string
      hostId: PlayerId | null
      players: PublicSeat[]
      status: GameStatus
    }
  | { type: 'ROSTER'; players: PublicSeat[]; hostId: PlayerId | null; status: GameStatus }
  | { type: 'SNAPSHOT'; state: GameState; turnDeadline: number | null }
  | { type: 'EVENTS'; events: GameEvent[] }
  | { type: 'ERROR'; message: string }
