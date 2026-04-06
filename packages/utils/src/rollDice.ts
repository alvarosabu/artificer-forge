export interface DiceResult {
  total: number
  rolls: number[]
  modifier: number
  critical: boolean
}

/**
 * Parse a dice string like "2d6", "1d4+1", "1d8" and roll it.
 * Optionally add a D&D 5e stat modifier: floor((statValue - 10) / 2).
 */
export function rollDice(dice: string, statValue?: number): DiceResult {
  const match = dice.match(/^(\d+)d(\d+)(?:\+(\d+))?$/)
  if (!match) throw new Error(`Invalid dice string: ${dice}`)

  const count = Number(match[1])
  const sides = Number(match[2])
  const flatBonus = Number(match[3] ?? 0)

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const statMod = statValue != null ? Math.floor((statValue - 10) / 2) : 0
  const rawTotal = rolls.reduce((sum, r) => sum + r, 0) + flatBonus + statMod

  // Critical: all dice rolled max
  const critical = rolls.every(r => r === sides)
  const total = critical
    ? rawTotal + rolls.reduce((sum, r) => sum + r, 0)
    : rawTotal

  return { total: Math.max(1, total), rolls, modifier: statMod + flatBonus, critical }
}
