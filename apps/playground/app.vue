<script setup lang="ts">
import { usePortraitStore } from '@artificer-forge/engine/runtime'

const portraitStore = usePortraitStore()

onMounted(() => portraitStore.hydrate())
</script>

<template>
  <UApp>
    <NuxtPage />
    <ClientOnly>
      <PortraitStudio />
    </ClientOnly>
  </UApp>
</template>