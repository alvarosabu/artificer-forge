import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DialogContext } from '@artificer-forge/engine/runtime'
import {
  applyEffects,
  availableChoices,
  evaluateCondition,
  evaluateConditions,
  resolveText,
  rollCheck,
} from '@artificer-forge/engine/runtime'

// === Minimal fake game store ===
// The engine only touches the methods exercised below, so a hand-rolled fake
// keeps these tests free of Pinia/Nuxt wiring.

interface FakeItem { id: string, templateId: string, quantity?: number }

function makeContext(opts: {
  player?: Partial<DialogContext['player']> & Record<string, unknown> | null
  speaker?: Record<string, unknown> | null
  party?: Record<string, unknown>[]
  flags?: Record<string, boolean | number>
  items?: FakeItem[]
} = {}): DialogContext {
  const flags: Record<string, boolean | number> = { ...(opts.flags ?? {}) }
  let items: FakeItem[] = [...(opts.items ?? [])]

  const gameStore = {
    setFlag: (k: string, v: boolean | number) => { flags[k] = v },
    getFlag: (k: string) => flags[k],
    hasFlag: (k: string) => !!flags[k],
    clearFlag: (k: string) => { delete flags[k] },
    itemsIn: () => items,
    removeEntity: (id: string) => { items = items.filter(i => i.id !== id) },
    updateEntity: (id: string, patch: Partial<FakeItem>) => {
      const it = items.find(i => i.id === id)
      if (it) Object.assign(it, patch)
    },
    addStatusEffect: vi.fn(),
    removeStatusEffect: vi.fn(),
    learnAbility: vi.fn(),
    spawnItemEntity: vi.fn(),
    // expose mutable state for assertions
    _flags: flags,
    _items: () => items,
  } as unknown as DialogContext['gameStore']

  return {
    player: (opts.player ?? null) as DialogContext['player'],
    speaker: (opts.speaker ?? null) as DialogContext['speaker'],
    partyEntities: (opts.party ?? []) as unknown as DialogContext['partyEntities'],
    gameStore,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('evaluateCondition', () => {
  it('flag string-form is truthy (matches numeric flags too)', () => {
    expect(evaluateCondition({ flag: 'met_king' }, makeContext({ flags: { met_king: true } }))).toBe(true)
    expect(evaluateCondition({ flag: 'rep' }, makeContext({ flags: { rep: 3 } }))).toBe(true)
    expect(evaluateCondition({ flag: 'rep' }, makeContext({ flags: { rep: 0 } }))).toBe(false)
    expect(evaluateCondition({ flag: 'missing' }, makeContext())).toBe(false)
  })

  it('flag object-form compares exact value', () => {
    const ctx = makeContext({ flags: { stage: 2 } })
    expect(evaluateCondition({ flag: { stage: 2 } }, ctx)).toBe(true)
    expect(evaluateCondition({ flag: { stage: 3 } }, ctx)).toBe(false)
  })

  it('notFlag passes only when the flag is unset/falsy', () => {
    expect(evaluateCondition({ notFlag: 'done' }, makeContext())).toBe(true)
    expect(evaluateCondition({ notFlag: 'done' }, makeContext({ flags: { done: true } }))).toBe(false)
  })

  it('class / race / faction match the player', () => {
    const ctx = makeContext({ player: { class: 'rogue', race: 'elf', faction: 'thieves' } })
    expect(evaluateCondition({ class: 'rogue' }, ctx)).toBe(true)
    expect(evaluateCondition({ class: 'paladin' }, ctx)).toBe(false)
    expect(evaluateCondition({ race: 'elf' }, ctx)).toBe(true)
    expect(evaluateCondition({ faction: 'thieves' }, ctx)).toBe(true)
  })

  it('stat comparisons honour gte/lte', () => {
    const ctx = makeContext({ player: { stats: { strength: 14, dexterity: 8 } } })
    expect(evaluateCondition({ stat: { strength: { gte: 14 } } }, ctx)).toBe(true)
    expect(evaluateCondition({ stat: { strength: { gte: 15 } } }, ctx)).toBe(false)
    expect(evaluateCondition({ stat: { dexterity: { lte: 10 } } }, ctx)).toBe(true)
  })

  it('partyHas matches by class or templateId', () => {
    const ctx = makeContext({ party: [{ class: 'cleric', templateId: 'sister-mary' }] })
    expect(evaluateCondition({ partyHas: 'cleric' }, ctx)).toBe(true)
    expect(evaluateCondition({ partyHas: 'sister-mary' }, ctx)).toBe(true)
    expect(evaluateCondition({ partyHas: 'wizard' }, ctx)).toBe(false)
  })

  it('hasItem sums quantities to meet the required qty', () => {
    const ctx = makeContext({
      player: { id: 'p1' },
      items: [{ id: 'a', templateId: 'gold', quantity: 6 }, { id: 'b', templateId: 'gold', quantity: 5 }],
    })
    expect(evaluateCondition({ hasItem: { id: 'gold', qty: 10 } }, ctx)).toBe(true)
    expect(evaluateCondition({ hasItem: { id: 'gold', qty: 12 } }, ctx)).toBe(false)
  })

  it('unknown condition keys fail closed', () => {
    expect(evaluateCondition({ bogus: 1 }, makeContext())).toBe(false)
  })
})

describe('evaluateConditions', () => {
  it('returns true for empty/undefined and requires all to pass', () => {
    const ctx = makeContext({ player: { class: 'rogue' }, flags: { ok: true } })
    expect(evaluateConditions(undefined, ctx)).toBe(true)
    expect(evaluateConditions([], ctx)).toBe(true)
    expect(evaluateConditions([{ class: 'rogue' }, { flag: 'ok' }], ctx)).toBe(true)
    expect(evaluateConditions([{ class: 'rogue' }, { flag: 'missing' }], ctx)).toBe(false)
  })
})

describe('rollCheck', () => {
  it('adds the stat modifier and resolves success at the DC', () => {
    // strength 14 → modifier +2; d20 = 13 → total 15
    vi.spyOn(Math, 'random').mockReturnValue(0.6) // floor(0.6*20)=12 → roll 13
    const ctx = makeContext({ player: { stats: { strength: 14 } } })
    const roll = rollCheck({ skill: 'athletics', dc: 15 }, ctx)
    expect(roll.modifier).toBe(2)
    expect(roll.roll).toBe(13)
    expect(roll.total).toBe(15)
    expect(roll.success).toBe(true)
  })

  it('advantage takes the higher of two d20s', () => {
    const seq = [0.1, 0.9] // → rolls 3 then 19
    vi.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0)
    const ctx = makeContext({ player: { stats: { charisma: 10 } } })
    const roll = rollCheck({ skill: 'persuasion', dc: 15, advantage: true }, ctx)
    expect(roll.roll).toBe(19)
    expect(roll.modifier).toBe(0)
  })

  it('defaults to a stat of 10 (mod 0) when the player lacks the stat', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const roll = rollCheck({ skill: 'arcana', dc: 5 }, makeContext({ player: {} }))
    expect(roll.modifier).toBe(0)
    expect(roll.roll).toBe(1)
  })
})

describe('applyEffects', () => {
  it('setFlag and clearFlag mutate world flags (clear unsets the key)', () => {
    const ctx = makeContext({ flags: { old: true } })
    applyEffects([{ setFlag: { met_king: true, rep: 5 } }], ctx)
    expect(ctx.gameStore.getFlag('met_king')).toBe(true)
    expect(ctx.gameStore.getFlag('rep')).toBe(5)

    applyEffects([{ clearFlag: 'old' }], ctx)
    expect(ctx.gameStore.getFlag('old')).toBeUndefined()
  })

  it('takeItem removes whole stacks and decrements the partial remainder', () => {
    const ctx = makeContext({
      player: { id: 'p1' },
      items: [{ id: 'a', templateId: 'gold', quantity: 6 }, { id: 'b', templateId: 'gold', quantity: 5 }],
    })
    applyEffects([{ takeItem: { id: 'gold', qty: 8 } }], ctx)
    const store = ctx.gameStore as unknown as { _items: () => FakeItem[] }
    const left = store._items()
    // First stack (6) fully consumed; second decremented 5 → 3.
    expect(left).toHaveLength(1)
    expect(left[0]!.id).toBe('b')
    expect(left[0]!.quantity).toBe(3)
  })

  it('signals endDialog', () => {
    expect(applyEffects([{ endDialog: true }], makeContext()).endDialog).toBe(true)
    expect(applyEffects([{ setFlag: { x: true } }], makeContext()).endDialog).toBeFalsy()
  })
})

describe('availableChoices', () => {
  it('locks choices with failed conditions and surfaces a reason', () => {
    const ctx = makeContext({ player: { class: 'rogue' } })
    const node = {
      text: '',
      choices: [
        { text: 'Pick the lock', conditions: [{ class: 'rogue' }] },
        { text: 'Cast spell', conditions: [{ class: 'wizard' }] },
      ],
    }
    const resolved = availableChoices(node, ctx)
    expect(resolved[0]!.available).toBe(true)
    expect(resolved[1]!.available).toBe(false)
    expect(resolved[1]!.lockedReason).toBe('Requires wizard')
    expect(resolved[1]!.hide).toBe(false)
  })

  it('marks hidden choices when lockedDisplay is "hide"', () => {
    const ctx = makeContext({ player: { class: 'rogue' } })
    const node = {
      text: '',
      choices: [{ text: 'secret', conditions: [{ class: 'wizard' }], lockedDisplay: 'hide' as const }],
    }
    expect(availableChoices(node, ctx)[0]!.hide).toBe(true)
  })
})

describe('resolveText', () => {
  it('returns the first matching variant, else the base text', () => {
    const ctx = makeContext({ flags: { met_king: true } })
    const node = {
      text: 'Hello stranger.',
      textVariants: [{ if: { flag: 'met_king' }, text: 'Welcome back.' }],
    }
    expect(resolveText(node, ctx)).toBe('Welcome back.')
    expect(resolveText(node, makeContext())).toBe('Hello stranger.')
  })
})
