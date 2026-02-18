<script setup lang="ts">
defineEmits<{
  endTurn: []
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 pl-3 border-l border-gold-700/50">
    <!-- End Turn button -->
    <UButton
      color="primary"
      variant="solid"
      size="lg"
      class="font-serif font-bold tracking-wide rounded-xl px-4 shadow-lg shadow-gold-900/30"
      @click="$emit('endTurn')"
    >
      End Turn
    </UButton>
  </div>
</template>
