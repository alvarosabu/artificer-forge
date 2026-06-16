import { reactive } from 'vue'
import type { EntityState } from '@artificer-forge/engine/runtime'
import { createSharedComposable } from '@vueuse/core'

interface DragState {
  draggingItem: EntityState | null
}

export const useItemDrag = createSharedComposable(() => {
  const state = reactive<DragState>({ draggingItem: null })

  function start(item: EntityState) {
    state.draggingItem = item
  }
  function end() {
    state.draggingItem = null
  }

  return { state, start, end }
})
