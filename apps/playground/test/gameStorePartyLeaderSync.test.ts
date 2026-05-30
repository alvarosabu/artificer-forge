import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../stores/game'

describe('game store: selecting a party member syncs the leader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('promotes a selected party member to leader so the action bar follows', () => {
    const store = useGameStore()
    store.addToParty('hero')
    store.addToParty('fenrath')

    // First recruit becomes leader by default.
    expect(store.party.leader).toBe('hero')

    // Clicking a party panel selects that member.
    store.selectEntity('fenrath')

    // The action bar keys off party.leader, so selection must move it too.
    expect(store.party.leader).toBe('fenrath')
    expect(store.selectedEntityId).toBe('fenrath')
  })

  it('does not change the leader when selecting a non-party entity', () => {
    const store = useGameStore()
    store.addToParty('hero')

    store.selectEntity('wandering_npc')

    expect(store.party.leader).toBe('hero')
    expect(store.selectedEntityId).toBe('wandering_npc')
  })

  it('clearing the selection leaves the leader intact', () => {
    const store = useGameStore()
    store.addToParty('hero')

    store.selectEntity(null)

    expect(store.party.leader).toBe('hero')
    expect(store.selectedEntityId).toBeNull()
  })
})
