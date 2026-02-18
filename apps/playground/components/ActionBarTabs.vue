<script setup lang="ts">
const props = defineProps<{
  active: 'common' | 'items' | 'passives'
}>()

const emit = defineEmits<{
  change: ['common' | 'items' | 'passives']
}>()

const tabs = [
  { id: 'common' as const, label: 'Common' },
  { id: 'items' as const, label: 'Items' },
  { id: 'passives' as const, label: 'Passives' },
]
</script>

<template>
  <div class="flex gap-4 pt-1 border-t border-[#3a2a10]/60">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase transition-colors"
      :class="active === tab.id ? 'text-white' : 'text-[#5a4a30] hover:text-[#9a7a50]'"
      @click="emit('change', tab.id)"
    >
      <span
        v-if="active === tab.id"
        class="text-[#d4a843] text-[8px] leading-none"
      >●</span>
      {{ tab.label }}
    </button>
  </div>
</template>
