import { describe, expect, it } from 'vitest'
import { axialKey, neighborsOf } from '../hex'
import { generateMap, mapRadius } from '../mapgen'

function playerIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`)
}

describe('generateMap 결정론', () => {
  it('같은 시드 + 같은 인원이면 완전히 동일한 맵이 나온다', () => {
    const a = generateMap(12345, playerIds(4))
    const b = generateMap(12345, playerIds(4))
    expect(a).toEqual(b)
  })

  it('시드가 다르면 맵이 달라진다 (극히 낮은 확률로 우연히 같을 수 있으나 이 시드 쌍은 다름)', () => {
    const a = generateMap(1, playerIds(4))
    const b = generateMap(2, playerIds(4))
    expect(a).not.toEqual(b)
  })
})

describe.each([2, 3, 4, 5, 6])('generateMap (%i인)', (count) => {
  const seed = 999 + count
  const ids = playerIds(count)
  const map = generateMap(seed, ids)

  it(`반지름은 3+인원수(${mapRadius(count)})`, () => {
    expect(map.radius).toBe(mapRadius(count))
  })

  it('각 플레이어는 기지 1개를 갖고, 기지 타일은 평지다', () => {
    expect(Object.keys(map.bases)).toHaveLength(count)
    for (const pid of ids) {
      const pos = map.startPositions[pid]
      const tile = map.tiles[axialKey(pos)]
      expect(tile.terrain).toBe('plains')
      expect(map.bases[axialKey(pos)]).toBe(pid)
    }
  })

  it('기지 주변 1칸은 모두 평지다', () => {
    for (const pid of ids) {
      const pos = map.startPositions[pid]
      for (const n of neighborsOf(pos)) {
        const tile = map.tiles[axialKey(n)]
        if (tile) expect(tile.terrain).toBe('plains')
      }
    }
  })

  it('모든 기지는 장애물 없이 서로 도달 가능하다 (연결성)', () => {
    const passable = (k: string) => map.tiles[k]?.terrain !== 'obstacle'
    const start = map.startPositions[ids[0]]
    const seen = new Set<string>([axialKey(start)])
    const queue = [start]
    while (queue.length) {
      const cur = queue.shift()!
      for (const n of neighborsOf(cur)) {
        const k = axialKey(n)
        if (!map.tiles[k] || seen.has(k) || !passable(k)) continue
        seen.add(k)
        queue.push(n)
      }
    }
    for (const pid of ids) {
      expect(seen.has(axialKey(map.startPositions[pid]))).toBe(true)
    }
  })

  it('장애물 비율이 대략 설계 목표(8%) 근처다', () => {
    const total = Object.keys(map.tiles).length
    const obstacles = Object.values(map.tiles).filter((t) => t.terrain === 'obstacle').length
    expect(obstacles / total).toBeLessThan(0.2)
  })
})
