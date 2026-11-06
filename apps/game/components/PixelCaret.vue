<script setup lang="ts">
import caretUrl from '~/assets/svg/pixel-caret-down.svg'
</script>

<!-- source is 9×6 cells; 4px per cell keeps edges crisp -->
<template>
  <img :src="caretUrl" alt="" aria-hidden="true" class="h-6 w-9">
</template>
