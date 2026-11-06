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
    title="Commands"
    :ui="{
      overlay: 'bg-black/25',
      content: 'max-w-xl bg-transparent ring-0 shadow-none rounded-none divide-y-0 overflow-visible',
    }"
    @update:open="(open: boolean) => { if (!open) close() }"
  >
    <template #content>
      <div class="relative isolate px-8 pt-12 pb-14">
        <svg
          class="absolute inset-0 -z-10 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="var(--ui-bg)"
            d="M9 7C30 2 68 4 91 6C99 7 100 15 98 30C97 46 100 61 98 79C97 94 91 98 76 97C56 95 36 99 15 97C4 96 1 87 3 75C5 63 0 53 2 41C3 27-1 10 9 7Z"
          />
        </svg>

        <span class="absolute -top-2 left-8 -rotate-6 rounded-xl bg-primary px-5 py-1.5 text-lg font-black text-highlighted">
          Commands
        </span>

        <UCommandPalette
          v-model:search-term="searchTerm"
          :groups="groups"
          placeholder="Search commands..."
          :fuse="{ resultLimit: 12 }"
          size="lg"
          :ui="{
            root: 'max-h-96 divide-y-0 font-bold',
            content: 'mt-3 rounded-2xl bg-elevated',
            viewport: 'divide-y-0 py-2',
            group: 'px-2 py-1',
            label: 'ps-17 text-sm text-continue',
            item: 'items-center text-base before:hidden',
            itemLabel: 'px-3 py-0.5 text-default',
            itemLabelBase: [
              'relative isolate',
              'before:absolute before:-inset-x-3 before:top-[0.5em] before:-z-10 before:h-[0.75em] before:rounded-full before:bg-selection before:hidden group-data-highlighted:before:block',
              '[&>mark]:bg-transparent [&>mark]:text-accent',
            ].join(' '),
          }"
        >
          <template #item-leading>
            <PixelHand class="invisible shrink-0 group-data-highlighted:visible" />
          </template>
        </UCommandPalette>

        <PixelCaret class="absolute right-12 bottom-6 animate-bounce motion-reduce:animate-none" />
      </div>
    </template>
  </UModal>
</template>
