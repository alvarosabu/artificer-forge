<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { type ContextMenuState, useGameStore } from '@artificer-forge/engine/runtime'
import { useEntityActions } from '../useEntityActions'

const props = defineProps<{
  state: ContextMenuState
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  action: [action: string, entityId: string]
}>()

const gameStore = useGameStore()
const { getActionsForEntity } = useEntityActions()

interface MenuItem {
  label: string
  icon?: string
  color?: string
  _actionId: string
}

const entity = computed(() => {
  if (!props.state.entityId) { return null }
  return gameStore.getEntity(props.state.entityId)
})

// Custom DOM menu (NOT Nuxt UI's UDropdownMenu — its dismissable layer treats the
// opening right-click as an outside interaction and closes immediately over the canvas).
const menuItems = computed<MenuItem[]>(() =>
  getActionsForEntity(entity.value).flat() as unknown as MenuItem[],
)

function close() {
  emit('update:open', false)
}

function handleAction(actionId: string) {
  if (props.state.entityId) {
    emit('action', actionId, props.state.entityId)
  }
  close()
}

const menuEl = useTemplateRef<HTMLElement>('menuEl')
onClickOutside(menuEl, () => {
  if (props.state.open) { close() }
})
onKeyStroke('Escape', () => {
  if (props.state.open) { close() }
})
</script>

<template>
  <div
    v-if="state.open && menuItems.length"
    ref="menuEl"
    class="fixed z-50 min-w-40 py-1 bg-gradient-to-b from-marine-900/95 to-purple-800/40 border-2 border-gold-600/70 rounded-lg shadow-xl shadow-black/60 backdrop-blur-sm"
    :style="{ left: `${state.x}px`, top: `${state.y}px` }"
    @contextmenu.prevent
  >
    <button
      v-for="item in menuItems"
      :key="item._actionId"
      type="button"
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-serif transition-colors"
      :class="item.color === 'error'
        ? 'text-red-300 hover:bg-red-500/15'
        : 'text-gold-200 hover:bg-gold-600/15'"
      @click="handleAction(item._actionId)"
    >
      <UIcon
        v-if="item.icon"
        :name="item.icon"
        class="w-4 h-4 shrink-0"
      />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>
