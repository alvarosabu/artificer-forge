<script setup lang="ts">
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