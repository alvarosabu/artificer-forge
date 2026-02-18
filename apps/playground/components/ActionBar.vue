<script setup lang="ts">
import type { ActionSlot } from '~/composables/useActionBar'

defineProps<{
  playerName: string
  playerHp: number
  playerMaxHp: number
  playerPortrait?: string
  slots: ActionSlot[]
}>()

const emit = defineEmits<{
  activate: [index: number]
}>()
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
    <div class="flex items-end justify-center pb-4 px-4 pointer-events-auto">
      <div
        class="flex items-center gap-3 bg-gradient-to-b from-marine-900/80 from-80% to-purple-800/30 backdrop-blur-sm border-2 border-gold-600/70 rounded-xl p-3 shadow-2xl shadow-black/50"
      >
        <!-- Player portrait -->
        <div class="flex flex-col items-center gap-3 pr-3 border-r border-gold-700/50 relative">
          <div
            class="absolute top-0 left-[50%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-gold-400 shrink-0 overflow-hidden shadow-lg shadow-black/60"
          >
            <img
              v-if="playerPortrait"
              :src="playerPortrait"
              :alt="`${playerName} portrait`"
              class="w-full h-full object-cover object-top"
            />
            <div
              v-else
              class="w-full h-full bg-gradient-to-br from-primary to-blue flex items-center justify-center"
            >
              <UIcon
                name="i-heroicons-user"
                class="w-8 h-8 text-primary"
              />
            </div>
          </div>
          <div class="h-[50px]"></div>
          <div class="flex flex-col items-center gap-1 min-w-[120px]">
            <span class="font-serif font-bold text-white truncate">
              {{ playerName }}
            </span>
            <UProgress
              size="md"
              :ui="{ base: 'bg-black' }"
              class="border border-3 border-black rounded-full"
              color="error"
              :model-value="playerHp"
              :max="playerMaxHp"
            />
            
          </div>
        </div>

        <!-- Action slots -->
        <div class="flex gap-1.5">
          <button
            v-for="(slot, index) in slots"
            :key="slot.id"
            :disabled="slot.disabled"
            :title="slot.label"
            :class="[
              'relative w-12 h-12 rounded-lg border transition-all',
              'flex flex-col items-center justify-center',
              'hover:bg-gray-700/60 active:scale-95',
              slot.disabled
                ? 'opacity-40 cursor-not-allowed border-gray-700/30 bg-gray-900/40'
                : 'border-gray-600/50 bg-gray-800/60 cursor-pointer',
              slot.color === 'error' && !slot.disabled && 'border-red-500/40 hover:border-red-400/60',
            ]"
            @click="emit('activate', index)"
          >
            <UIcon
              :name="slot.icon"
              class="w-5 h-5"
            />
            <!-- Keyboard shortcut badge -->
            <span
              v-if="slot.shortcut"
              class="absolute -top-1.5 -right-1.5 text-[10px] font-mono bg-gray-900 border border-gray-600/50 rounded px-1 text-gray-400 leading-tight"
            >
              {{ slot.shortcut }}
            </span>
            <!-- Slot label -->
            <span class="text-[9px] text-gray-400 truncate max-w-[40px] mt-0.5">
              {{ slot.label }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
