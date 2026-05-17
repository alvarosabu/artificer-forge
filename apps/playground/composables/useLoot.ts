import { createSharedComposable } from '@vueuse/core'

interface LootState {
  containerId: string | null
  x: number
  y: number
}

export const useLoot = createSharedComposable(() => {
  const state = reactive<LootState>({ containerId: null, x: 0, y: 0 })

  function open(containerId: string, x: number, y: number) {
    state.containerId = containerId
    state.x = x
    state.y = y
  }

  function close() {
    state.containerId = null
  }

  return { state, open, close }
})
