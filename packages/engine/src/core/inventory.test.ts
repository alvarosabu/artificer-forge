import { describe, expect, it } from 'vitest'
import { carryCapacity, encumbrance, totalWeight } from './inventory'

describe('carryCapacity', () => {
  it('is 50 + 5 per strength point', () => {
    expect(carryCapacity(10)).toBe(100)
    expect(carryCapacity(16)).toBe(130)
  })

  it('defaults to strength 10', () => {
    expect(carryCapacity()).toBe(100)
  })
})

describe('totalWeight', () => {
  it('sums weight times quantity, treating missing fields as defaults', () => {
    expect(totalWeight([{ weight: 2, quantity: 3 }, { weight: 5 }, {}])).toBe(11)
  })

  it('is zero for an empty inventory', () => {
    expect(totalWeight([])).toBe(0)
  })
})

describe('encumbrance', () => {
  it('is the fraction of capacity used', () => {
    expect(encumbrance(50, 100)).toBe(0.5)
    expect(encumbrance(130, 100)).toBeCloseTo(1.3)
  })
})
