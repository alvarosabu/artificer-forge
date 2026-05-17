<script setup lang="ts">
import type { EntityState } from '~/stores/game'

const props = defineProps<{
  item: EntityState | null
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{
  click: [item: EntityState]
  contextmenu: [event: MouseEvent, item: EntityState]
}>()

const sizeClass = computed(() =>
  props.size === 'sm' ? 'w-12 h-12' : 'w-14 h-14',
)

const cell = useTemplateRef<HTMLElement>('cell')

const itemDrag = useItemDrag()

function onClick() {
  if (props.item) { emit('click', props.item) }
}

function onContext(e: MouseEvent) {
  e.preventDefault()
  if (props.item) { emit('contextmenu', e, props.item) }
}

function onDragStart(e: DragEvent) {
  if (!props.item) { return }
  itemDrag.start(props.item)
  e.dataTransfer?.setData('text/plain', props.item.id)
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move' }
}

function onDragEnd() {
  itemDrag.end()
}
</script>

<template>
  <UTooltip v-if="item" :delay-duration="200">
    <button
      ref="cell"
      class="relative rounded border border-leather-700/50 bg-leather-800/60 hover:border-gold-400/60 transition-colors cursor-grab active:cursor-grabbing"
      :class="[
        sizeClass,
      ]"
      :data-item-id="item.id"
      :draggable="true"
      @click="onClick"
      @contextmenu="onContext"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
    >
      <div class="absolute inset-1 flex items-center justify-center">
        <UIcon name="i-heroicons-cube" class="w-6 h-6 text-gold-300/80" />
      </div>
      <span
        v-if="(item.quantity ?? 1) > 1"
        class="absolute bottom-0 right-0.5 text-[10px] font-bold bg-leather-900/90 text-gold-200 ring-1 ring-gold-600/40 rounded px-1"
      >
        {{ item.quantity }}
      </span>
    </button>
    <template #content>
      <InventoryItemTooltip :item="item" />
    </template>
  </UTooltip>
  <div
    v-else
    ref="cell"
    class="rounded border border-leather-700/30 bg-leather-900/30"
    :class="[sizeClass]"
  ></div>
</template>
