<script setup lang="ts">
defineEmits<{
  endTurn: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <button
      class="px-5 py-3 rounded-full font-serif font-bold text-sm tracking-widest uppercase
        bg-gradient-to-b from-[#162616] to-[#0c180c]
        border-2 border-[#3d6e3d]
        text-[#7ab87a] hover:text-white
        hover:border-[#5a9e5a] hover:from-[#1a2f1a] hover:to-[#0f1f0f]
        shadow-[0_0_14px_rgba(61,110,61,0.35)]
        hover:shadow-[0_0_22px_rgba(90,158,90,0.5)]
        transition-all active:scale-95"
      @click="$emit('endTurn')"
    >
      End Turn
    </button>
  </div>
</template>
