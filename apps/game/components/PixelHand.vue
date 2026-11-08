<script setup lang="ts">
import pointerUrl from '~/assets/svg/pixel-hand-pointer.svg'
</script>

<!-- source is 15×20 cells pointing up; 2px per cell keeps edges crisp after the turn -->
<template>
  <span class="inline-grid h-[30px] w-10 place-items-center" aria-hidden="true">
    <img :src="pointerUrl" alt="" class="h-10 w-[30px] max-w-none rotate-90">
  </span>
</template>
