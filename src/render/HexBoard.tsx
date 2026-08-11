import { useMemo } from 'react'
import { axialKey } from '../shared/hex'
import type { AxialCoord, GameState, PlayerId } from '../shared/types'
import type { PlayerMeta } from '../state/gameStore'
import { axialToPixel, hexPolygonPoints } from './hexLayout'

const TERRAIN_FILL: Record<string, string> = {
  plains: '#c9b579',
  rough: '#4f6b3a',
  obstacle: '#3a3a3f',
}

const HEX_SIZE = 26

interface HexBoardProps {
  state: GameState
  players: PlayerMeta[]
  reachable: Set<string>
  attackable: Set<string>
  onTileClick: (coord: AxialCoord) => void
}

export function HexBoard({ state, players, reachable, attackable, onTileClick }: HexBoardProps) {
  const colorOf = useMemo(() => {
    const m = new Map(players.map((p) => [p.id, p.color]))
    return (pid: PlayerId) => m.get(pid) ?? '#888'
  }, [players])

  const tiles = useMemo(() => Object.values(state.tiles), [state.tiles])
  const points = useMemo(() => hexPolygonPoints(HEX_SIZE), [])

  const bounds = useMemo(() => {
    const positions = tiles.map((t) => axialToPixel(t.coord, HEX_SIZE))
    const xs = positions.map((p) => p.x)
    const ys = positions.map((p) => p.y)
    return {
      minX: Math.min(...xs) - HEX_SIZE,
      maxX: Math.max(...xs) + HEX_SIZE,
      minY: Math.min(...ys) - HEX_SIZE,
      maxY: Math.max(...ys) + HEX_SIZE,
    }
  }, [tiles])

  const units = useMemo(() => Object.values(state.units).filter((u) => u.alive && u.pos), [state.units])

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
      className="hex-board"
      role="img"
      aria-label="게임 보드"
    >
      {tiles.map((tile) => {
        const k = axialKey(tile.coord)
        const { x, y } = axialToPixel(tile.coord, HEX_SIZE)
        const isReachable = reachable.has(k)
        const isAttackable = attackable.has(k)
        const baseOwner = state.bases[k]
        const classes = ['hex-tile']
        if (isReachable) classes.push('hex-tile--reachable')
        if (isAttackable) classes.push('hex-tile--attackable')
        return (
          <g
            key={k}
            transform={`translate(${x},${y})`}
            onClick={() => onTileClick(tile.coord)}
            className={classes.join(' ')}
          >
            <polygon points={points} fill={TERRAIN_FILL[tile.terrain]} stroke="#1c1c1c" strokeWidth={1} />
            {baseOwner && (
              <circle r={HEX_SIZE * 0.55} fill="none" stroke={colorOf(baseOwner)} strokeWidth={4} />
            )}
          </g>
        )
      })}
      {units.map((u) => {
        const { x, y } = axialToPixel(u.pos!, HEX_SIZE)
        const barWidth = HEX_SIZE * 0.8
        const hpRatio = Math.max(0, u.hp) / 100
        const hpColor = u.hp > 50 ? '#5cb85c' : u.hp > 25 ? '#e6b800' : '#d9534f'
        return (
          <g key={u.playerId} transform={`translate(${x},${y})`} className="hex-unit">
            <circle r={HEX_SIZE * 0.4} fill={colorOf(u.playerId)} stroke="#111" strokeWidth={2} />
            {u.fortified && (
              <circle r={HEX_SIZE * 0.4 + 4} fill="none" stroke="#fff" strokeDasharray="3 2" strokeWidth={1.5} />
            )}
            <rect x={-barWidth / 2} y={HEX_SIZE * 0.5} width={barWidth} height={5} fill="#222" />
            <rect x={-barWidth / 2} y={HEX_SIZE * 0.5} width={barWidth * hpRatio} height={5} fill={hpColor} />
          </g>
        )
      })}
    </svg>
  )
}
