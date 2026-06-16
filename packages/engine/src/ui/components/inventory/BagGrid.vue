<script setup lang="ts">
import { computed, ref } from 'vue'
import { type EntityState, useGameStore } from '@artificer-forge/engine/runtime'
import { useItemDrag } from '../../useItemDrag'
import InventoryItemCell from './ItemCell.vue'
import InventoryWeightBar from './WeightBar.vue'

const props = defineProps<{
  characterId: string
}>()

const emit = defineEmits<{
  itemClick: [item: EntityState]
  itemContext: [event: MouseEvent, item: EntityState]
}>()

const gameStore = useGameStore()
const itemDrag = useItemDrag()

const items = computed(() => gameStore.itemsIn(props.characterId))
const weight = computed(() => gameStore.weightOf(props.characterId))
const capacity = computed(() => gameStore.capacityOf(props.characterId))

const ROWS_VISIBLE = 6
const COLS = 8

const isOverDropZone = ref(false)
const dragged = computed(() => itemDrag.state.draggingItem)
const isValidTarget = computed(() => {
  const d = dragged.value
  if (!d) return false
  // Bag accepts: any item not already in this bag (incl. unequip from same char)
  return d.containerId !== props.characterId || !!d.slot
})

const dropZoneClass = computed(() => {
  if (!dragged.value) return ''
  if (isOverDropZone.value && isValidTarget.value) {
    return 'ring-2 ring-gold-300/70 bg-gold-500/5'
  }
  if (isValidTarget.value) {
    return 'ring-2 ring-gold-500/30 ring-dashed'
  }
  return ''
})

function onDragOver(e: DragEvent) {
  if (!dragged.value || !isValidTarget.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  isOverDropZone.value = true
}

function onDragLeave() {
  isOverDropZone.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isOverDropZone.value = false
  const d = dragged.value
  if (!d) return
  if (d.containerId === props.characterId && d.slot) {
    gameStore.unequipItem(d.id)
  }
  else {
    gameStore.moveItem(d.id, { containerId: props.characterId })
  }
  itemDrag.end()
}
</script>

<template>
  <div
    class="flex flex-col gap-2 h-full rounded transition-all duration-150"
    :class="dropZoneClass"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      class="grid gap-1 overflow-y-auto pr-1"
      :style="{
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        maxHeight: `${ROWS_VISIBLE * 64 + (ROWS_VISIBLE - 1) * 4}px`,
      }"
    >
      <InventoryItemCell
        v-for="item in items"
        :key="item.id"
        :item="item"
        @click="(i) => emit('itemClick', i)"
        @contextmenu="(e, i) => emit('itemContext', e, i)"
      />
      <!-- Fill empty cells visually -->
      <InventoryItemCell
        v-for="i in Math.max(0, COLS * ROWS_VISIBLE - items.length)"
        :key="`empty-${i}`"
        :item="null"
      />
    </div>
    <InventoryWeightBar :current="weight" :capacity="capacity" />
  </div>
</template>
