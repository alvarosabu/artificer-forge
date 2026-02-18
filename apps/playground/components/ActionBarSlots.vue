<script setup lang="ts">
import type { ActionSlot } from '~/composables/useActionBar'

const props = defineProps<{
  slots: ActionSlot[]
  activeCategory: 'common' | 'items' | 'passives'
}>()

const emit = defineEmits<{
  activate: [index: number]
  categoryChange: ['common' | 'items' | 'passives']
}>()
</script>

<template>
  <div class="flex flex-col">
    <!-- Action grid -->
    <div class="grid grid-cols-4 gap-1">
      <div
        v-for="(slot, index) in slots"
        :key="slot.id"
        class="relative"
      >
        <UButton
          :disabled="slot.disabled"
          :title="slot.label"
          :color="slot.color ?? 'neutral'"
          variant="ghost"
          square
          size="xl"
          class="w-12 h-12"
          :icon="slot.icon"
          @click="emit('activate', index)"
        />

        <!-- Keyboard shortcut badge (top-left) -->
        <span
          v-if="slot.shortcut"
          class="absolute top-0.5 left-0.5 text-[9px] font-mono text-gray-500 leading-tight pointer-events-none"
        >
          {{ slot.shortcut }}
        </span>

        <!-- Stack quantity (top-right, for items) -->
        <UBadge
          v-if="slot.quantity !== undefined"
          :label="String(slot.quantity)"
          color="neutral"
          variant="solid"
          size="xs"
          class="absolute -top-1 -right-1 pointer-events-none"
        />

        <!-- AP cost indicator dot (bottom-right) -->
        <span
          v-if="slot.cost && slot.cost !== 'free'"
          class="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full pointer-events-none"
          :class="slot.cost === 'action' ? 'bg-gold-400' : 'bg-blue-400'"
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
