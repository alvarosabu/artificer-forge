<script setup lang="ts">
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
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

const open = computed({
  get: () => props.state.open,
  set: (value: boolean) => emit('update:open', value),
})

const entity = computed(() => {
  if (!props.state.entityId) return null
  return gameStore.getEntity(props.state.entityId)
})

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const items = getActionsForEntity(entity.value)

  return items.map(group =>
    group.map(item => ({
      ...item,
      onSelect: () => handleAction((item as any)._actionId),
    })),
  )
})

function handleAction(action: string) {
  if (props.state.entityId) {
    emit('action', action, props.state.entityId)
  }
  open.value = false
}
</script>

<template>
  <div
    v-if="open && menuItems.length"
    class="fixed z-50"
    :style="{ left: `${state.x}px`, top: `${state.y}px` }"
  >
    <UDropdownMenu
      v-model:open="open"
      :items="menuItems"
    >
      <template #default>
        <span class="sr-only">Context menu trigger</span>
      </template>
    </UDropdownMenu>
  </div>
</template>
