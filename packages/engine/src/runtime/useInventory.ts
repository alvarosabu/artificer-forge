import { computed, ref } from 'vue'
import { createSharedComposable, onKeyStroke } from '@vueuse/core'
import { useGameStore } from './stores/game'
import { isEditableTarget } from './keyboard'

export const useInventory = createSharedComposable(() => {
  const gameStore = useGameStore()

  const isOpen = ref(false)
  const focusedCharacterId = ref<string | null>(null)

  const focusedCharacter = computed(() => {
    if (!focusedCharacterId.value) { return null }
    return gameStore.getEntity(focusedCharacterId.value) ?? null
  })

  function open(characterId?: string) {
    focusedCharacterId.value = characterId
      ?? gameStore.selectedEntityId
      ?? gameStore.party.leader
      ?? gameStore.party.members[0]
      ?? null
    if (focusedCharacterId.value) { isOpen.value = true }
  }

  function close() {
    isOpen.value = false
  }

  function focus(characterId: string) {
    focusedCharacterId.value = characterId
  }

  function toggle() {
    if (isOpen.value) {
      close()
    }
    else { open() }
  }

  // Global hotkey
  onKeyStroke('i', (e) => {
    if (isEditableTarget(e)) { return }
    e.preventDefault()
    toggle()
  })

  onKeyStroke('Escape', () => {
    if (isOpen.value) { close() }
  })

  return {
    isOpen,
    focusedCharacterId,
    focusedCharacter,
    open,
    close,
    focus,
    toggle,
  }
})
