<script setup lang="ts">
const { isOpen, currentGroups, breadcrumbs, popPage, toggle, close } = useCommandPalette()

const searchInput = ref('')

defineShortcuts({
  meta_k: toggle,
  ctrl_k: toggle,
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Backspace' && searchInput.value === '') {
    popPage()
  }
}

watch(isOpen, (open) => {
  if (!open) searchInput.value = ''
})
</script>

<template>
  <UModal :open="isOpen" @update:open="(val: boolean) => { if (!val) close() }">
    <template #content>
      <div class="flex flex-col">
        <div
          v-if="breadcrumbs.length > 0"
          class="flex items-center gap-1 px-3 pt-3 pb-1 text-xs text-gray-400"
        >
          <span>Root</span>
          <span
            v-for="(crumb, i) in breadcrumbs"
            :key="i"
            class="flex items-center gap-1"
          >
            <span class="i-lucide-chevron-right text-gray-600" />
            <span class="text-gray-200">{{ crumb }}</span>
          </span>
        </div>
        <UCommandPalette
          v-model:search-term="searchInput"
          :groups="currentGroups"
          placeholder="Search commands..."
          :fuse="{ resultLimit: 12 }"
          class="h-96"
          @keydown="handleKeydown"
        />
      </div>
    </template>
  </UModal>
</template>
