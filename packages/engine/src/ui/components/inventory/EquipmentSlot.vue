<script setup lang="ts">
import { computed, ref } from 'vue'
import { type EntityState, type EquipmentSlotKey, useGameStore } from '@artificer-forge/engine/runtime'
import { useItemDrag } from '../../useItemDrag'
import InventoryItemTooltip from './ItemTooltip.vue'

const props = defineProps<{
  characterId: string
  slotKey: EquipmentSlotKey
}>()

const emit = defineEmits<{
  context: [event: MouseEvent, item: EntityState]
}>()

const gameStore = useGameStore()
const itemDrag = useItemDrag()

const item = computed(() => gameStore.equippedAt(props.characterId, props.slotKey))
const isOverDropZone = ref(false)

const SLOT_LABELS: Record<EquipmentSlotKey, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  helmet: 'Helmet',
  armor: 'Armor',
  gauntlets: 'Gauntlets',
  boots: 'Boots',
  amulet: 'Amulet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
}

const SLOT_ICONS: Record<EquipmentSlotKey, string> = {
  mainHand: 'i-lucide-swords',
  offHand: 'i-lucide-shield',
  helmet: 'i-lucide-hard-hat',
  armor: 'i-lucide-shirt',
  gauntlets: 'i-lucide-grab',
  boots: 'i-lucide-footprints',
  amulet: 'i-lucide-gem',
  ring1: 'i-lucide-circle-dot',
  ring2: 'i-lucide-circle-dot',
}

const slotLabel = computed(() => SLOT_LABELS[props.slotKey])
const slotIcon = computed(() => SLOT_ICONS[props.slotKey])

function onDragOver(e: DragEvent) {
  if (!itemDrag.state.draggingItem) return
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
  const dragged = itemDrag.state.draggingItem
  if (!dragged) return
  gameStore.moveItem(dragged.id, { containerId: props.characterId, slot: props.slotKey })
  itemDrag.end()
}

const dragged = computed(() => itemDrag.state.draggingItem)
const isValidTarget = computed(() =>
  !!dragged.value && gameStore.isItemTypeForSlot(dragged.value, props.slotKey),
)

const dropTargetClass = computed(() => {
  if (!dragged.value) { return '' }
  if (isOverDropZone.value) {
    return isValidTarget.value
      ? 'border-gold-300 bg-gold-500/20 ring-2 ring-gold-300/70 scale-105'
      : 'border-error/70 bg-error/20 ring-2 ring-error/60'
  }
  if (isValidTarget.value) {
    return 'border-gold-400/70 bg-gold-500/5 animate-pulse'
  }
  return 'opacity-50'
})
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <UTooltip
      v-if="item"
      :delay-duration="200"
      :ui="{ content: 'bg-transparent ring-0 shadow-none p-0 h-auto min-w-0' }"
    >
      <button
        class="w-14 h-14 rounded border-2 bg-leather-800/60 border-gold-500/50 ring-1 ring-gold-500/50 hover:border-gold-400 transition-all duration-150 cursor-pointer flex items-center justify-center"
        :class="[
          dropTargetClass,
        ]"
        :data-slot="slotKey"
        :data-character-id="characterId"
        @contextmenu.prevent="emit('context', $event, item!)"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <img
          v-if="item.icon"
          :src="item.icon"
          :alt="item.name"
          class="w-full h-full object-contain p-1 pointer-events-none select-none"
          draggable="false"
        />
        <UIcon v-else name="i-heroicons-cube" class="w-7 h-7 text-gold-200" />
      </button>
      <template #content>
        <InventoryItemTooltip :item="item" />
      </template>
    </UTooltip>
    <div
      v-else
      class="w-14 h-14 rounded border-2 border-dashed border-gold-600/40 flex items-center justify-center transition-all duration-150"
      :class="[
        dropTargetClass,
      ]"
      :data-slot="slotKey"
      :data-character-id="characterId"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <UIcon :name="slotIcon" class="w-6 h-6 text-gold-500/30" />
    </div>
    <span class="text-[10px] uppercase tracking-wider text-gold-400/60">{{ slotLabel }}</span>
  </div>
</template>
