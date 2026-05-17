<!-- apps/playground/components/inventory/BagGrid.vue -->
<script setup lang="ts">
import type { EntityState } from '~/stores/game'

const props = defineProps<{
  characterId: string
}>()

const emit = defineEmits<{
  'item-click': [item: EntityState]
  'item-context': [event: MouseEvent, item: EntityState]
}>()

const gameStore = useGameStore()

const items = computed(() => gameStore.itemsIn(props.characterId))
const weight = computed(() => gameStore.weightOf(props.characterId))
const capacity = computed(() => gameStore.capacityOf(props.characterId))

const ROWS_VISIBLE = 6
const COLS = 8
</script>

<template>
  <div class="flex flex-col gap-2 h-full">
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
        @click="(i) => emit('item-click', i)"
        @contextmenu="(e, i) => emit('item-context', e, i)"
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
