// Inventory weight / carry-capacity math — pure. The store collects a character's
// items and stats, then calls these.

export interface WeightedItem {
  weight?: number
  quantity?: number
}

/** Carry capacity from Strength: base 50 + 5 per point. */
export function carryCapacity(strength = 10): number {
  return 50 + strength * 5
}

/** Sum of weight × quantity across a list of items. */
export function totalWeight(items: WeightedItem[]): number {
  let total = 0
  for (const item of items) {
    total += (item.weight ?? 0) * (item.quantity ?? 1)
  }
  return total
}

/** Fraction of capacity used (0..1+). */
export function encumbrance(weight: number, capacity: number): number {
  return weight / capacity
}
