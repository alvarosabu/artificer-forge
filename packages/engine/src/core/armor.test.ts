import { describe, expect, it } from 'vitest'
import { deriveMaxArmor } from './armor'

describe('deriveMaxArmor', () => {
  it('sums physical and magical armor across equipped items', () => {
    const r = deriveMaxArmor([
      { armor: { physical: 10, magical: 2 } },
      { armor: { physical: 5 } },
      { armor: { magical: 3 } },
    ])
    expect(r).toEqual({ physical: 15, magical: 5 })
  })

  it('is zero for no equipped items', () => {
    expect(deriveMaxArmor([])).toEqual({ physical: 0, magical: 0 })
  })

  it('treats items without an armor field as zero', () => {
    expect(deriveMaxArmor([{}, { armor: { physical: 4 } }])).toEqual({ physical: 4, magical: 0 })
  })
})
