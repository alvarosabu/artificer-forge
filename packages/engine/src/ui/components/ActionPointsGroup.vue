<script setup lang="ts">
// No logic yet — visual placeholder
</script>

<template>
  <div class="flex gap-1 justify-center">
    <!-- Action -->
    <UButton
      size="sm"
      square
      icon="i-heroicons-stop-circle-solid"
      class="bg-[#5a1a1a] border border-[#8a2a2a] hover:bg-[#6a2020] text-[#e07070]"
      variant="ghost"
    />

    <!-- Bonus Action -->
    <UButton
      size="sm"
      square
      icon="i-heroicons-play-solid"
      class="bg-[#2a2a2a] border border-[#4a4a4a] hover:bg-[#333] text-[#aaaaaa] rotate-[-90deg]"
      variant="ghost"
    />

    <!-- Reaction -->
    <UButton
      size="sm"
      square
      icon="i-heroicons-hand-raised-solid"
      class="bg-[#0e2a30] border border-[#1a5060] hover:bg-[#123540] text-[#40b8d8]"
      variant="ghost"
    >
      <template #trailing>
        <span class="text-[9px] font-bold text-[#40b8d8] leading-none">4</span>
      </template>
    </UButton>
  </div>
</template>
