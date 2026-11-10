<script setup lang="ts">
import pointerUrl from '~/assets/svg/pixel-hand-pointer.svg'

withDefaults(defineProps<{ direction?: 'right' | 'up' }>(), { direction: 'right' })
</script>

<!-- source is 15×20 cells pointing up; 2px per cell keeps edges crisp after the turn -->
<template>
  <span
    v-if="direction === 'right'"
    class="inline-grid h-[30px] w-10 place-items-center"
    aria-hidden="true"
  >
    <img :src="pointerUrl" alt="" class="h-10 w-[30px] max-w-none rotate-90">
  </span>
  <img
    v-else
    :src="pointerUrl"
    alt=""
    aria-hidden="true"
    class="h-10 w-[30px] max-w-none"
  >
</template>
