<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

const loot = useLoot()
const gameStore = useGameStore()

const container = computed(() =>
  loot.state.containerId ? gameStore.getEntity(loot.state.containerId) : null,
)
const items = computed(() =>
  loot.state.containerId ? gameStore.itemsIn(loot.state.containerId) : [],
)

function takeAll() {
  const leader = gameStore.party.leader
  if (!leader || !loot.state.containerId) { return }
  for (const item of [...items.value]) {
    const result = gameStore.moveItem(item.id, { containerId: leader })
    if (!result.ok) {
      console.warn(`[loot] failed to move ${item.name}: ${result.reason}`)
    }
  }
  if (items.value.length === 0) { loot.close() }
}

onKeyStroke('Escape', () => {
  if (loot.state.containerId) { loot.close() }
})
</script>

<template>
  <div
    v-if="container && loot.state.containerId"
    class="fixed z-50 w-72 bg-gradient-to-b from-marine-900/95 to-purple-800/40 border-2 border-gold-600/70 rounded-xl shadow-xl shadow-black/60"
    :style="{ left: `${loot.state.x}px`,
              top: `${loot.state.y}px` }"
  >
    <div class="flex items-center justify-between px-3 py-2 border-b border-gold-600/30">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-archive-box" class="w-4 h-4 text-gold-300" />
        <span class="font-serif text-gold-200 text-sm">{{ container.name }}</span>
      </div>
      <button class="text-gold-400 hover:text-gold-200" @click="loot.close()">×</button>
    </div>

    <div class="p-2">
      <div
        class="grid gap-1"
        :style="{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }"
      >
        <InventoryItemCell
          v-for="item in items"
          :key="item.id"
          :item="item"
          size="sm"
        />
        <InventoryItemCell
          v-for="i in Math.max(0, 24 - items.length)"
          :key="`empty-${i}`"
          :item="null"
          size="sm"
        />
      </div>
    </div>

    <div class="px-3 py-2 border-t border-gold-600/30">
      <UButton
        block
        color="primary"
        variant="soft"
        :disabled="items.length === 0"
        @click="takeAll"
      >
        Take All
      </UButton>
    </div>
  </div>
</template>
