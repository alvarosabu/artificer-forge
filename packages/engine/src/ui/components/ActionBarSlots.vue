<script setup lang="ts">
import { computed } from 'vue'
import type { ActionSlot } from '@artificer-forge/engine/runtime'
import ActionBarTabs from './ActionBarTabs.vue'

const GRID_SIZE = 24 // 8×3

const props = defineProps<{
  slots: ActionSlot[]
  activeCategory: 'common' | 'items' | 'passives'
}>()

const emit = defineEmits<{
  activate: [index: number]
  categoryChange: ['common' | 'items' | 'passives']
}>()

const paddedSlots = computed<(ActionSlot | null)[]>(() => {
  const result: (ActionSlot | null)[] = [...props.slots]
  while (result.length < GRID_SIZE) result.push(null)
  return result.slice(0, GRID_SIZE)
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- 8×3 action grid -->
    <div class="grid grid-cols-8 gap-1">
      <div
        v-for="(slot, index) in paddedSlots"
        :key="slot?.id ?? `empty-${index}`"
        class="relative w-11 h-11"
      >
        <!-- Filled slot -->
        <UTooltip
          v-if="slot"
          :text="slot.label"
          :kbds="slot.shortcut ? [slot.shortcut] : undefined"
        >
          <button
            :disabled="slot.disabled"
            class="w-full h-full flex items-center justify-center rounded-sm transition-all
              bg-[#120e08] border border-[#5a3e1b]
              hover:border-[#c8922a] hover:bg-[#1e1609]
              active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            :class="slot.active ? 'border-[#e8b84b] shadow-[0_0_6px_rgba(232,184,75,0.4)]' : ''"
            @click="emit('activate', index)"
          >
            <UIcon :name="slot.icon" class="w-5 h-5 text-[#d4a843]" />
          </button>
        </UTooltip>

        <!-- Empty slot frame -->
        <div
          v-else
          class="w-full h-full rounded-sm bg-[#0c0a06] border border-[#2a1f0e] opacity-50"
        />

        <!-- Quantity badge (top-right) -->
        <UBadge
          v-if="slot?.quantity !== undefined"
          :label="String(slot.quantity)"
          color="neutral"
          variant="solid"
          size="xs"
          class="absolute -top-1 -right-1 pointer-events-none"
        />

        <!-- AP cost dot (bottom-right) -->
        <span
          v-if="slot?.cost && slot.cost !== 'free'"
          class="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full pointer-events-none"
          :class="slot.cost === 'action' ? 'bg-[#d4a843]' : 'bg-[#6ab0e8]'"
        />
      </div>
    </div>

    <!-- Category tabs -->
    <ActionBarTabs
      :active="activeCategory"
      @change="emit('categoryChange', $event)"
    />
  </div>
</template>
