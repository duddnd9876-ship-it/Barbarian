import { BASE_DMG, BASE_STRENGTH, BASE_TILE_DEF, FORTIFY_DEF, HP_MAX, MAX_DAMAGE, MIN_DAMAGE, ROUGH_DEF } from './config'
import type { Terrain } from './types'

export interface CombatContext {
  attackerHp: number
  defenderHp: number
  defenderTerrain: Terrain
  defenderOnOwnBase: boolean
  defenderFortified: boolean
}

export interface CombatResult {
  attackerDamage: number
  defenderDamage: number
  attackerHpAfter: number
  defenderHpAfter: number
}

function hpFactor(hp: number): number {
  return 0.5 + 0.5 * (hp / HP_MAX)
}

function defenderBonus(ctx: CombatContext): number {
  let bonus = 0
  if (ctx.defenderTerrain === 'rough') bonus += ROUGH_DEF
  if (ctx.defenderOnOwnBase) bonus += BASE_TILE_DEF
  if (ctx.defenderFortified) bonus += FORTIFY_DEF
  return bonus
}

export function effectiveStrength(hp: number, defenseBonus: number): number {
  return BASE_STRENGTH * (1 + defenseBonus) * hpFactor(hp)
}

function clampDamage(v: number): number {
  return Math.min(MAX_DAMAGE, Math.max(MIN_DAMAGE, Math.round(v)))
}

/** 기획서 1.4 전투 공식. 난수 없음 — 같은 입력이면 언제나 같은 결과. */
export function resolveCombat(ctx: CombatContext): CombatResult {
  const attackerEff = effectiveStrength(ctx.attackerHp, 0)
  const defenderEff = effectiveStrength(ctx.defenderHp, defenderBonus(ctx))
  const ratio = attackerEff / defenderEff

  const defenderDamage = clampDamage(BASE_DMG * ratio ** 1.5)
  const attackerDamage = clampDamage(BASE_DMG * ratio ** -1.5)

  return {
    attackerDamage,
    defenderDamage,
    attackerHpAfter: Math.max(0, ctx.attackerHp - attackerDamage),
    defenderHpAfter: Math.max(0, ctx.defenderHp - defenderDamage),
  }
}
