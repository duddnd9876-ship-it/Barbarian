import type { Command, GameEvent, GameState, GameStatus, PlayerId } from '../shared/types'

// worker/protocol.ts와 짝을 이루는 클라이언트 쪽 타입. 서버 코드를 그대로 import하지 않는 이유는
// worker-configuration.d.ts가 선언하는 전역 타입(WebSocket 등)이 브라우저 DOM lib와 충돌하기 때문.
// 프로토콜을 바꿀 때는 두 파일을 함께 수정해야 한다.

export interface PublicSeat {
  id: PlayerId
  name: string
  color: string
  connected: boolean
}

export type ClientMessage = { type: 'START' } | { type: 'COMMAND'; command: Command }

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
