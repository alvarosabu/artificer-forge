<script setup lang="ts">
import { useDialogCamera } from '../useDialogCamera'

// Invisible Tres node; lives inside the canvas so useTresContext() can resolve the active camera.
useDialogCamera()
</script>

<template>
  <TresGroup />
</template>
