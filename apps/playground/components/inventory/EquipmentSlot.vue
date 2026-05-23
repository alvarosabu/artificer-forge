<script setup lang="ts">
import type { EntityState, EquipmentSlotKey } from '~/stores/game'
import { useDropZone } from '@vueuse/core'

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

const slotEl = useTemplateRef<HTMLElement>('slotEl')

const { isOverDropZone } = useDropZone(slotEl, {
  onDrop: () => {
    const dragged = itemDrag.state.draggingItem
    if (!dragged) { return }
    gameStore.moveItem(dragged.id, { containerId: props.characterId, slot: props.slotKey })
    itemDrag.end()
  },
})

const dropTargetClass = computed(() => {
  if (!isOverDropZone.value) { return '' }
  const dragged = itemDrag.state.draggingItem
  const valid = !!dragged && gameStore.isItemTypeForSlot(dragged, props.slotKey)
  return valid ? 'border-gold-300 bg-gold-500/10' : 'border-error/60 bg-error/10'
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
        ref="slotEl"
        class="w-14 h-14 rounded border-2 bg-leather-800/60 border-gold-500/50 ring-1 ring-gold-500/50 hover:border-gold-400 transition-colors cursor-pointer flex items-center justify-center"
        :class="[
          dropTargetClass,
        ]"
        :data-slot="slotKey"
        :data-character-id="characterId"
        @contextmenu.prevent="emit('context', $event, item!)"
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
      ref="slotEl"
      class="w-14 h-14 rounded border-2 border-dashed border-gold-600/40 flex items-center justify-center"
      :class="[
        dropTargetClass,
      ]"
      :data-slot="slotKey"
      :data-character-id="characterId"
    >
      <UIcon :name="slotIcon" class="w-6 h-6 text-gold-500/30" />
    </div>
    <span class="text-[10px] uppercase tracking-wider text-gold-400/60">{{ slotLabel }}</span>
  </div>
</template>
