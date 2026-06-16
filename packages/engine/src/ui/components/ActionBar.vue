<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { useActionBar, useGameStore, usePortraitRenderer } from '@artificer-forge/engine/runtime'
import ActionBarPortrait from './ActionBarPortrait.vue'
import ActionBarWeapon from './ActionBarWeapon.vue'
import ActionPointsGroup from './ActionPointsGroup.vue'
import ActionBarSlots from './ActionBarSlots.vue'
import ActionBarResources from './ActionBarResources.vue'

const gameStore = useGameStore()
const { playerEntity, playerClassId, slots, activeCategory, setCategory, activateSlot, activeWeaponSlot, setActiveWeaponSlot, toggleWeaponSlot } = useActionBar()

// Keyboard shortcuts (1–9,0 → ability slots; Tab → weapon swap). @vueuse keydown
// rather than Nuxt UI's defineShortcuts so this component stays package-portable.
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
SLOT_KEYS.forEach((key, idx) => onKeyStroke(key, (e) => {
  e.preventDefault()
  activateSlot(idx)
}))
onKeyStroke('Tab', (e) => {
  e.preventDefault()
  toggleWeaponSlot()
})

// Portrait rendered dynamically from the player's live model (falls back to the
// entity's `portrait` field / icon when generation is unavailable).
const { url: playerPortrait } = usePortraitRenderer(computed(() => playerEntity.value?.id ?? ''))

// Resolve class metadata via the engine's injected content source (not queryCollection).
const playerClass = ref<Record<string, any> | null>(null)
watch(playerClassId, async (id) => {
  playerClass.value = id ? await gameStore.resolveClass(id) : null
}, { immediate: true })
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
    <div class="flex items-center justify-center pb-4 px-4 pointer-events-auto gap-3">
      <!-- Portrait — outside the card -->
      <ActionBarPortrait
        v-if="playerEntity"
        :name="playerEntity.name"
        :hp="playerEntity.hp ?? 0"
        :max-hp="playerEntity.maxHp ?? 1"
        :portrait="playerPortrait"
        :class-emblem="playerClass?.emblem"
        :class-color="playerClass?.color"
      />

      <!-- Weapon slots — outside the card -->
      <ActionBarWeapon
        :main-hand="playerEntity ? gameStore.equippedAt(playerEntity.id, 'mainHand')?.templateId : undefined"
        :off-hand="playerEntity ? gameStore.equippedAt(playerEntity.id, 'offHand')?.templateId : undefined"
        :active-slot="activeWeaponSlot"
        @select-slot="setActiveWeaponSlot"
      />

      <!-- AP group + main card stacked -->
      <div class="flex flex-col items-center gap-1">
        <ActionPointsGroup />

        <!-- Main card: action grid + category tabs only -->
        <div
          class="bg-gradient-to-b from-marine-900/80 from-80% to-purple-800/30 backdrop-blur-sm border-2 border-gold-600/70 rounded-xl px-4 py-3 shadow-2xl shadow-black/50"
        >
          <ActionBarSlots
            :slots="slots"
            :active-category="activeCategory"
            @activate="activateSlot"
            @category-change="setCategory"
          />
        </div>
      </div>

      <!-- End Turn — outside the card -->
      <ActionBarResources @end-turn="() => {}" />
    </div>
  </div>
</template>
