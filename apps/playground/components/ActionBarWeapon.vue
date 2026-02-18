<script setup lang="ts">
defineProps<{
  mainHand?: string
  offHand?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Main hand slot -->
    <div
      class="w-11 h-11 rounded-sm border border-[#5a3e1b] bg-[#120e08] flex items-center justify-center relative"
      title="Main Hand"
    >
      <UIcon
        v-if="mainHand"
        name="i-heroicons-bolt"
        class="w-5 h-5 text-[#d4a843]"
      />
      <UIcon
        v-else
        name="i-heroicons-hand-raised"
        class="w-5 h-5 text-[#3a2a10]"
      />
      <span class="absolute -bottom-1 -right-1 text-[7px] bg-[#0c0a06] border border-[#3a2a10] rounded px-0.5 text-[#5a4a30] leading-tight">
        MH
      </span>
    </div>

    <!-- Off hand slot -->
    <div
      class="w-11 h-11 rounded-sm border border-[#5a3e1b] bg-[#120e08] flex items-center justify-center relative"
      title="Off Hand"
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
    </div>
  </div>
</template>
