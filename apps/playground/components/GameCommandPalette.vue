<script setup lang="ts">
const { isOpen, groups, toggle } = useCommandPalette()

defineShortcuts({
  meta_k: toggle,
  ctrl_k: toggle,
})
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Search commands..."
        :fuse="{ resultLimit: 12 }"
        class="h-96"
      />
    </template>
  </UModal>
</template>
