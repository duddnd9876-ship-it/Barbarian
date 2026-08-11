import { describe, expect, it } from 'vitest'
import { resolveCombat } from '../combat'

// 기획서 1.4 "수치 감각"에 나온 3가지 골든 값을 그대로 고정한다.
describe('resolveCombat (골든 값)', () => {
  it('평지 만피 vs 평지 만피 -> 서로 24', () => {
    const r = resolveCombat({
      attackerHp: 100,
      defenderHp: 100,
      defenderTerrain: 'plains',
      defenderOnOwnBase: false,
      defenderFortified: false,
    })
    expect(r.attackerDamage).toBe(24)
    expect(r.defenderDamage).toBe(24)
  })

  it('평지 만피 -> 험지 만피 공격 시 공격자 44 / 방어자 13', () => {
    const r = resolveCombat({
      attackerHp: 100,
      defenderHp: 100,
      defenderTerrain: 'rough',
      defenderOnOwnBase: false,
      defenderFortified: false,
    })
    expect(r.attackerDamage).toBe(44)
    expect(r.defenderDamage).toBe(13)
  })

  it('만피 -> 반피 공격 시 공격자 16 / 방어자 37', () => {
    const r = resolveCombat({
      attackerHp: 100,
      defenderHp: 50,
      defenderTerrain: 'plains',
      defenderOnOwnBase: false,
      defenderFortified: false,
    })
    expect(r.attackerDamage).toBe(16)
    expect(r.defenderDamage).toBe(37)
  })

  it('데미지는 항상 10~100 사이로 클램프된다', () => {
    const r = resolveCombat({
      attackerHp: 100,
      defenderHp: 1,
      defenderTerrain: 'plains',
      defenderOnOwnBase: false,
      defenderFortified: false,
    })
    expect(r.defenderDamage).toBeLessThanOrEqual(100)
    expect(r.attackerDamage).toBeGreaterThanOrEqual(10)
  })

  it('같은 입력이면 항상 같은 결과 (난수 없음)', () => {
    const ctx = {
      attackerHp: 77,
      defenderHp: 42,
      defenderTerrain: 'rough' as const,
      defenderOnOwnBase: true,
      defenderFortified: true,
    }
    expect(resolveCombat(ctx)).toEqual(resolveCombat(ctx))
  })
})
