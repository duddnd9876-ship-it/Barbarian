import { DurableObject } from 'cloudflare:workers'
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, TURN_SECONDS } from '../src/shared/config'
import { applyCommand, createGame } from '../src/shared/reducer'
import { hashStringToSeed } from '../src/shared/rng'
import type { Command, GameEvent, GameState, GameStatus, PlayerId } from '../src/shared/types'
import { applyFogOfWar, computeVisibleHexes, isEventVisibleTo } from '../src/shared/view'
import { parseClientMessage, type PublicSeat, type ServerMessage } from './protocol'

interface SeatInfo {
  id: PlayerId
  name: string
  color: string
  token: string
  connected: boolean
}

interface RoomMeta {
  status: GameStatus
  hostId: PlayerId | null
  seats: SeatInfo[]
}

interface WsAttachment {
  playerId: PlayerId
}

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>
  ASSETS: Fetcher
}

/** 방 하나 = GameRoom Durable Object 하나. 클라이언트 명령을 받아 shared reducer로 판정하는 권위 서버. */
export class GameRoom extends DurableObject<Env> {
  private meta: RoomMeta = { status: 'lobby', hostId: null, seats: [] }
  private game: GameState | null = null
  private turnDeadline: number | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const [meta, game, turnDeadline] = await Promise.all([
        ctx.storage.get<RoomMeta>('meta'),
        ctx.storage.get<GameState>('game'),
        ctx.storage.get<number>('turnDeadline'),
      ])
      if (meta) this.meta = meta
      if (game) this.game = game
      if (turnDeadline) this.turnDeadline = turnDeadline
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const url = new URL(request.url)
    const name = (url.searchParams.get('name') || '플레이어').trim().slice(0, 20) || '플레이어'
    const token = url.searchParams.get('token') || undefined

    const joined = this.joinOrReclaim(name, token)
    if (!joined.ok) {
      return new Response(joined.error, { status: 403 })
    }

    const pair = new WebSocketPair()
    const server = pair[1]
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: joined.seat.id } satisfies WsAttachment)

    this.persist()
    this.broadcastRoster()
    this.sendTo(server, {
      type: 'JOINED',
      playerId: joined.seat.id,
      token: joined.seat.token,
      hostId: this.meta.hostId,
      players: this.publicSeats(),
      status: this.meta.status,
    })
    if (this.game) {
      this.sendTo(server, { type: 'SNAPSHOT', state: this.viewFor(joined.seat.id), turnDeadline: this.turnDeadline })
    }

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as WsAttachment | null
    if (!attachment) return

    let message
    try {
      message = parseClientMessage(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      this.sendTo(ws, { type: 'ERROR', message: 'INVALID_MESSAGE' })
      return
    }

    if (message.type === 'START') {
      this.handleStart(attachment.playerId)
    } else if (message.type === 'COMMAND') {
      this.handleCommand(attachment.playerId, message.command)
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as WsAttachment | null
    if (!attachment) return
    const seat = this.meta.seats.find((s) => s.id === attachment.playerId)
    if (!seat) return

    const stillConnected = this.ctx.getWebSockets().some((other) => {
      if (other === ws) return false
      const otherAttachment = other.deserializeAttachment() as WsAttachment | null
      return otherAttachment?.playerId === attachment.playerId
    })
    seat.connected = stillConnected
    this.persist()
    this.broadcastRoster()
  }

  async alarm(): Promise<void> {
    if (!this.game || this.game.status !== 'playing') return
    const currentPlayerId = this.game.turnOrder[this.game.currentPlayerIndex]
    const result = applyCommand(this.game, currentPlayerId, { type: 'END_TURN' })
    if (!result.ok) return

    this.game = result.state
    if (this.game.status === 'playing') {
      this.scheduleTurnTimer()
    } else {
      this.turnDeadline = null
    }
    this.persist()
    this.broadcastSnapshot(result.events)
  }

  private joinOrReclaim(name: string, token?: string): { ok: true; seat: SeatInfo } | { ok: false; error: string } {
    if (token) {
      const existing = this.meta.seats.find((s) => s.token === token)
      if (existing) {
        existing.name = name
        existing.connected = true
        return { ok: true, seat: existing }
      }
    }

    if (this.meta.status !== 'lobby') {
      return { ok: false, error: 'GAME_ALREADY_STARTED' }
    }
    if (this.meta.seats.length >= MAX_PLAYERS) {
      return { ok: false, error: 'ROOM_FULL' }
    }

    const seat: SeatInfo = {
      id: `p${this.meta.seats.length + 1}`,
      name,
      color: PLAYER_COLORS[this.meta.seats.length % PLAYER_COLORS.length],
      token: crypto.randomUUID(),
      connected: true,
    }
    this.meta.seats.push(seat)
    if (!this.meta.hostId) this.meta.hostId = seat.id
    return { ok: true, seat }
  }

  private handleStart(playerId: PlayerId): void {
    if (this.meta.status !== 'lobby') return
    if (playerId !== this.meta.hostId) {
      this.sendToPlayer(playerId, { type: 'ERROR', message: 'ONLY_HOST_CAN_START' })
      return
    }
    if (this.meta.seats.length < MIN_PLAYERS) {
      this.sendToPlayer(playerId, { type: 'ERROR', message: 'NOT_ENOUGH_PLAYERS' })
      return
    }

    const seed = hashStringToSeed(crypto.randomUUID())
    this.game = createGame(this.meta.seats.map((s) => s.id), seed)
    this.meta.status = 'playing'
    this.scheduleTurnTimer()
    this.persist()
    this.broadcastRoster()
    this.broadcastSnapshot([])
  }

  private handleCommand(playerId: PlayerId, command: Command): void {
    if (!this.game) return
    const result = applyCommand(this.game, playerId, command)
    if (!result.ok) {
      this.sendToPlayer(playerId, { type: 'ERROR', message: result.error })
      return
    }

    this.game = result.state
    if (this.game.status === 'finished') {
      this.turnDeadline = null
    } else {
      this.scheduleTurnTimer()
    }
    this.persist()
    this.broadcastSnapshot(result.events)
  }

  private scheduleTurnTimer(): void {
    this.turnDeadline = Date.now() + TURN_SECONDS * 1000
    this.ctx.storage.setAlarm(this.turnDeadline)
  }

  private persist(): void {
    this.ctx.storage.put('meta', this.meta)
    if (this.game) this.ctx.storage.put('game', this.game)
    if (this.turnDeadline !== null) {
      this.ctx.storage.put('turnDeadline', this.turnDeadline)
    } else {
      this.ctx.storage.delete('turnDeadline')
    }
  }

  private publicSeats(): PublicSeat[] {
    return this.meta.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, connected: s.connected }))
  }

  private broadcastRoster(): void {
    this.broadcast({
      type: 'ROSTER',
      players: this.publicSeats(),
      hostId: this.meta.hostId,
      status: this.meta.status,
    })
  }

  /** 시야 안 밖을 가리지 않는 "진짜" 상태를 아는 사람인지 — 관전(탈락)이거나 게임이 끝났으면 안개를 걷는다. */
  private canSeeEverything(playerId: PlayerId, game: GameState): boolean {
    return game.status !== 'playing' || game.eliminated.includes(playerId)
  }

  private viewFor(playerId: PlayerId): GameState {
    const game = this.game!
    if (this.canSeeEverything(playerId, game)) return game
    return applyFogOfWar(game, playerId)
  }

  private broadcastSnapshot(events: GameEvent[]): void {
    if (!this.game) return
    const game = this.game

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WsAttachment | null
      if (!attachment) continue
      const viewerId = attachment.playerId

      if (this.canSeeEverything(viewerId, game)) {
        this.sendTo(ws, { type: 'SNAPSHOT', state: game, turnDeadline: this.turnDeadline })
        if (events.length > 0) this.sendTo(ws, { type: 'EVENTS', events })
        continue
      }

      const visible = computeVisibleHexes(game, viewerId)
      this.sendTo(ws, { type: 'SNAPSHOT', state: applyFogOfWar(game, viewerId, visible), turnDeadline: this.turnDeadline })
      const visibleEvents = events.filter((e) => isEventVisibleTo(e, viewerId, game, visible))
      if (visibleEvents.length > 0) this.sendTo(ws, { type: 'EVENTS', events: visibleEvents })
    }
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) ws.send(payload)
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    ws.send(JSON.stringify(message))
  }

  private sendToPlayer(playerId: PlayerId, message: ServerMessage): void {
    const payload = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WsAttachment | null
      if (attachment?.playerId === playerId) ws.send(payload)
    }
  }
}
