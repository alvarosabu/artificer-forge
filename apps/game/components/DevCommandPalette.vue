<script setup lang="ts">
const { isOpen, groups, toggle, close } = useCommandPalette()

const searchTerm = ref('')

defineShortcuts({
  meta_k: toggle,
  ctrl_k: toggle,
})

watch(isOpen, (open) => {
  if (!open) searchTerm.value = ''
})
</script>

<template>
  <UModal
    :open="isOpen"
    @update:open="(open: boolean) => { if (!open) close() }"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        placeholder="Search commands..."
        :fuse="{ resultLimit: 12 }"
        class="h-96"
      />
    </template>
  </UModal>
</template>
