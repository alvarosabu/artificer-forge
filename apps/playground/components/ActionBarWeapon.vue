<script setup lang="ts">
defineProps<{
  mainHand?: string
  offHand?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5 pr-3 border-r border-gold-700/50">
    <!-- Main hand slot -->
    <div
      class="w-11 h-11 rounded-lg border border-gold-600/40 bg-gray-900/60 flex items-center justify-center relative"
      title="Main Hand"
    >
      <UIcon
        v-if="mainHand"
        name="i-heroicons-bolt"
        class="w-5 h-5 text-gold-400"
      />
      <UIcon
        v-else
        name="i-heroicons-hand-raised"
        class="w-5 h-5 text-gray-600"
      />
      <span class="absolute -bottom-1 -right-1 text-[8px] bg-gray-900 border border-gray-700 rounded px-0.5 text-gray-400 leading-tight">
        MH
      </span>
    </div>

    <!-- Off hand slot -->
    <div
      class="w-11 h-11 rounded-lg border border-gold-600/40 bg-gray-900/60 flex items-center justify-center relative"
      title="Off Hand"
    >
      <UIcon
        v-if="offHand"
        name="i-heroicons-shield-check"
        class="w-5 h-5 text-gold-400"
      />
      <UIcon
        v-else
        name="i-heroicons-hand-raised"
        class="w-5 h-5 text-gray-600"
      />
      <span class="absolute -bottom-1 -right-1 text-[8px] bg-gray-900 border border-gray-700 rounded px-0.5 text-gray-400 leading-tight">
        OH
      </span>
    </div>
  </div>
</template>
