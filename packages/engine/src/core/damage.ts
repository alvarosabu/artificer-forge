// Combat damage resolution — pure. The store resolves armorType from the damage-type
// data and writes `next` back; this module only does the math.

export type ArmorType = 'physical' | 'magical'

/** Minimal target shape the damage math needs — a subset of any entity. */
export interface ArmorHpState {
  hp?: number
  physicalArmor?: number
  magicalArmor?: number
}

export interface DamageResult {
  armorAbsorbed: number
  hpDamage: number
  /** Fields to write back: always `hp`, plus the depleted armor pool when one applied. */
  next: { hp: number, physicalArmor?: number, magicalArmor?: number }
}

/**
 * Deplete the matching armor pool first; overflow hits HP. `armorType` undefined
 * (e.g. an untyped/true-damage hit) bypasses armor entirely.
 */
export function computeDamage(target: ArmorHpState, amount: number, armorType?: ArmorType): DamageResult {
  let remaining = amount
  let armorAbsorbed = 0
  const next: DamageResult['next'] = { hp: target.hp ?? 0 }

  if (armorType === 'physical' || armorType === 'magical') {
    const key = armorType === 'physical' ? 'physicalArmor' : 'magicalArmor'
    const current = target[key] ?? 0
    armorAbsorbed = Math.min(current, remaining)
    next[key] = current - armorAbsorbed
    remaining -= armorAbsorbed
  }

  const hpDamage = remaining
  next.hp = Math.max(0, (target.hp ?? 0) - hpDamage)
  return { armorAbsorbed, hpDamage, next }
}
