<script setup lang="ts">
defineProps<{
  name: string
  hp: number
  maxHp: number
  portrait?: string
  classEmblem?: string
  classColor?: string
}>()
</script>

<template>
  <div class="flex items-end gap-2 pr-3 border-r border-gold-700/50">
    <!-- Class emblem — small circle -->
    <div
      class="relative shrink-0 w-12 h-12 rounded-full border-2 overflow-hidden bg-gray-900/80 shadow-lg"
      :class="classColor ? `border-${classColor}-500` : 'border-gold-600/50'"
    >
      <img
        v-if="classEmblem"
        :src="classEmblem"
        alt="Class emblem"
        class="w-full h-full object-cover"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
      >
        <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-gold-400/60" />
      </div>
    </div>

    <!-- Portrait + name/HP column -->
    <div class="flex flex-col items-center gap-1 relative">
      <!-- Portrait circle — larger, half-overlapping upward -->
      <div
        class="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 border-gold-400 overflow-hidden shadow-lg shadow-black/60 bg-gray-900"
      >
        <img
          v-if="portrait"
          :src="portrait"
          :alt="`${name} portrait`"
          class="w-full h-full object-cover object-top"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-blue"
        >
          <UIcon name="i-heroicons-user" class="w-8 h-8 text-gold-400" />
        </div>
      </div>

      <!-- Spacer for portrait overlap -->
      <div class="h-10" />

      <!-- Name + HP -->
      <div class="flex flex-col items-center gap-1 min-w-[100px]">
        <span class="font-serif font-bold text-white text-sm truncate">{{ name }}</span>
        <UProgress
          size="sm"
          :ui="{ base: 'bg-black' }"
          class="border border-black rounded-full"
          color="error"
          :model-value="hp"
          :max="maxHp"
        />
        <span class="text-[10px] text-gold-400/70">{{ hp }} / {{ maxHp }}</span>
      </div>
    </div>
  </div>
</template>
