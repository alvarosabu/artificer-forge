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
  <div class="flex gap-1 mt-1.5 border-t border-gold-700/30 pt-1.5">
    <UButton
      v-for="tab in tabs"
      :key="tab.id"
      size="xs"
      :variant="active === tab.id ? 'solid' : 'ghost'"
      :color="active === tab.id ? 'primary' : 'neutral'"
      :label="tab.label"
      @click="emit('change', tab.id)"
    />
  </div>
</template>
