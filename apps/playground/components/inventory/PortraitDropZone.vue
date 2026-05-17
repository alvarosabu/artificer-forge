<script setup lang="ts">
import { useDropZone } from '@vueuse/core'

const props = defineProps<{
  characterId: string
}>()

const gameStore = useGameStore()
const itemDrag = useItemDrag()

const zoneEl = useTemplateRef<HTMLElement>('zoneEl')

const { isOverDropZone } = useDropZone(zoneEl, {
  onDrop: () => {
    const dragged = itemDrag.state.draggingItem
    if (!dragged) { return }
    gameStore.transferItem(dragged.id, props.characterId)
    itemDrag.end()
  },
})
</script>

<template>
  <div
    ref="zoneEl"
    class="rounded transition-colors"
    :class="[isOverDropZone ? 'ring-2 ring-gold-300' : '']"
  >
    <slot></slot>
  </div>
</template>
