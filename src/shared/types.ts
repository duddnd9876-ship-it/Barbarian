export type PlayerId = string
export type HexKey = string

export type Terrain = 'plains' | 'rough' | 'obstacle'

export interface AxialCoord {
  q: number
  r: number
}

export interface Tile {
  coord: AxialCoord
  terrain: Terrain
  baseOwner?: PlayerId
}

export interface Unit {
  playerId: PlayerId
  pos: AxialCoord | null
  hp: number
  movesLeft: number
  fortified: boolean
  attackedThisTurn: boolean
  alive: boolean
  /** 사망 시 RESPAWN_DELAY로 세팅, 0이 되면 CHOOSE_RESPAWN 가능. 생존 중이면 null. */
  respawnIn: number | null
}

export interface MoveCommand {
  type: 'MOVE'
  to: AxialCoord
}
export interface AttackCommand {
  type: 'ATTACK'
  target: AxialCoord
}
export interface FortifyCommand {
  type: 'FORTIFY'
}
export interface EndTurnCommand {
  type: 'END_TURN'
}
export interface ChooseRespawnCommand {
  type: 'CHOOSE_RESPAWN'
  at: AxialCoord
}

export type Command =
  | MoveCommand
  | AttackCommand
  | FortifyCommand
  | EndTurnCommand
  | ChooseRespawnCommand

export type GameEventType =
  | 'MOVED'
  | 'ATTACKED'
  | 'CAPTURED_BASE'
  | 'UNIT_DIED'
  | 'UNIT_RESPAWNED'
  | 'PLAYER_ELIMINATED'
  | 'HEALED'
  | 'FORTIFIED'
  | 'GAME_ENDED'

export interface GameEvent {
  type: GameEventType
  playerId?: PlayerId
  [extra: string]: unknown
}

export type GameStatus = 'lobby' | 'playing' | 'finished'

export interface GameState {
  seed: number
  round: number
  turnOrder: PlayerId[]
  currentPlayerIndex: number
  tiles: Record<HexKey, Tile>
  units: Record<PlayerId, Unit>
  /** hexKey -> 소유 플레이어 */
  bases: Record<HexKey, PlayerId>
  eliminated: PlayerId[]
  status: GameStatus
  winner: PlayerId | null
  damageDealt: Record<PlayerId, number>
}
