<script setup lang="ts">
const props = defineProps<{
  name: string
  hp: number
  maxHp: number
  portrait?: string
  classEmblem?: string
  classColor?: string
}>()

// 0% at full HP → 100% at 0 HP, fills from bottom up
const bloodFill = computed(() => {
  if (props.maxHp === 0) return 0
  return Math.max(0, Math.min(100, (1 - props.hp / props.maxHp) * 100))
})
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Portrait circle with class badge + HP overlaid -->
    <div class="relative">
      <div
        class="relative w-36 h-36 rounded-full border-2 border-[#c8922a] overflow-hidden bg-[#120e08] shadow-lg shadow-black/70"
      >
        <img
          v-if="portrait"
          :src="portrait"
          :alt="name"
          class="w-full h-full object-cover object-top"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center"
        >
          <UIcon name="i-heroicons-user" class="w-12 h-12 text-[#c8922a]" />
        </div>

        <!-- Blood fill overlay — rises from bottom as HP drops -->
        <div
          class="absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-700 ease-out"
          :style="{
            height: `${bloodFill}%`,
            background: 'linear-gradient(to top, rgba(140, 8, 8, 0.9) 0%, rgba(180, 20, 20, 0.7) 90%, rgba(200, 30, 30, 0) 100%)',
          }"
        />
      </div>

      <!-- Class badge — bottom-left of portrait -->
      <div
        class="absolute -bottom-1 -left-1 w-7 h-7 rounded-full border border-[#5a3e1b] bg-[#1a1208] flex items-center justify-center overflow-hidden shadow-sm"
      >
        <img
          v-if="classEmblem"
          :src="classEmblem"
          alt="Class"
          class="w-full h-full object-cover"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <UIcon
          v-else
          name="i-heroicons-shield-check"
          class="w-4 h-4 text-[#c8922a]/70"
        />
      </div>

      <!-- HP — overlaid at bottom of portrait -->
      <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {{ hp }} / {{ maxHp }}
      </div>
    </div>
  </div>
</template>
