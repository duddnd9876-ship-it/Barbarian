import { GameRoom } from './gameRoom'

export { GameRoom }

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>
  ASSETS: Fetcher
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,10}$/

function generateRoomCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return Response.json({ roomCode: generateRoomCode() })
    }

    if (url.pathname.startsWith('/ws/')) {
      const code = url.pathname.slice('/ws/'.length).toUpperCase()
      if (!ROOM_CODE_PATTERN.test(code)) {
        return new Response('Invalid room code', { status: 400 })
      }
      const stub = env.GAME_ROOM.getByName(code)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
