import type { AxialCoord } from '../shared/types'

const SQRT3 = Math.sqrt(3)

/** Pointy-top axial -> 화면 픽셀 좌표. (redblobgames.com/grids/hexagons 공식) */
export function axialToPixel(c: AxialCoord, size: number): { x: number; y: number } {
  return {
    x: size * (SQRT3 * c.q + (SQRT3 / 2) * c.r),
    y: size * 1.5 * c.r,
  }
}

export function hexPolygonPoints(size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`)
  }
  return pts.join(' ')
}
