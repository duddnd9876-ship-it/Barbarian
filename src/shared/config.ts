// 기획서 1.7 밸런스 상수. 서버(파이어베이스 함수 등)와 클라이언트가 동일 값을 참조해야 한다.
export const HP_MAX = 100
export const BASE_STRENGTH = 10
export const BASE_DMG = 24

export const MOVE_POINTS = 2
export const ROUGH_MOVE_COST = 2

export const ROUGH_DEF = 0.5
export const BASE_TILE_DEF = 0.25
export const FORTIFY_DEF = 0.2

export const HEAL_PER_TURN = 25
export const RESPAWN_DELAY = 3
export const RESPAWN_HP_RATIO = 0.5

export const TURN_SECONDS = 45
export const MAX_ROUNDS = 60

export const VISION_UNIT = 2
export const VISION_BASE = 3

export const OBSTACLE_RATIO = 0.08
export const ROUGH_RATIO = 0.25

export const MIN_DAMAGE = 10
export const MAX_DAMAGE = 100

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** 좌석 순서대로 배정되는 플레이어 색상. 로컬 핫싯 클라이언트와 온라인 서버(GameRoom)가 공유한다. */
export const PLAYER_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4'] as const
