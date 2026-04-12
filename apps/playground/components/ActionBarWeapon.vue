<script setup lang="ts">
import type { WeaponSlot } from '~/composables/useActionBar'

defineProps<{
  mainHand?: string
  offHand?: string
  activeSlot: WeaponSlot
}>()

const emit = defineEmits<{
  'select-slot': [slot: WeaponSlot]
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Main hand slot -->
    <button
      class="w-11 h-11 rounded-sm border flex items-center justify-center relative transition-colors"
      :class="activeSlot === 'mainHand'
        ? 'border-[#d4a843] bg-[#1a1408]'
        : 'border-[#5a3e1b] bg-[#120e08] opacity-60'"
      title="Main Hand (Tab)"
      @click="emit('select-slot', 'mainHand')"
    >
      <UIcon
        v-if="mainHand"
        name="i-af-melee-attk"
        class="w-5 h-5 text-[#d4a843]"
      />
      <UIcon
        v-else
        name="i-af-ranged-attk"
        class="w-5 h-5 text-[#3a2a10]"
      />
      <span class="absolute -bottom-1 -right-1 text-[7px] bg-[#0c0a06] border border-[#3a2a10] rounded px-0.5 text-[#5a4a30] leading-tight">
        MH
      </span>
    </button>

    <!-- Off hand slot -->
    <button
      class="w-11 h-11 rounded-sm border flex items-center justify-center relative transition-colors"
      :class="activeSlot === 'offHand'
        ? 'border-[#d4a843] bg-[#1a1408]'
        : 'border-[#5a3e1b] bg-[#120e08] opacity-60'"
      title="Off Hand (Tab)"
      @click="emit('select-slot', 'offHand')"
    >
      <UIcon
        v-if="offHand"
        name="i-heroicons-shield-check"
        class="w-5 h-5 text-[#d4a843]"
      />
      <UIcon
        v-else
        name="i-heroicons-hand-raised"
        class="w-5 h-5 text-[#3a2a10]"
      />
      <span class="absolute -bottom-1 -right-1 text-[7px] bg-[#0c0a06] border border-[#3a2a10] rounded px-0.5 text-[#5a4a30] leading-tight">
        OH
      </span>
    </button>
  </div>
</template>
