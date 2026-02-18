<script setup lang="ts">
const { playerEntity, playerClassId, slots, activeCategory, setCategory, activateSlot } = useActionBar()

// Resolve class metadata from content collection
const { data: playerClass } = await useAsyncData(
  () => `class-${playerClassId.value}`,
  () => {
    if (!playerClassId.value) return Promise.resolve(null)
    return queryCollection('classes').where('classId', '=', playerClassId.value).first()
  },
  { watch: [playerClassId] },
)
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
    <div class="flex items-end justify-center pb-4 px-4 pointer-events-auto">
      <div
        class="flex items-end gap-3 bg-gradient-to-b from-marine-900/80 from-80% to-purple-800/30 backdrop-blur-sm border-2 border-gold-600/70 rounded-xl p-3 shadow-2xl shadow-black/50"
      >
        <!-- Portrait zone: class emblem + portrait + HP -->
        <ActionBarPortrait
          v-if="playerEntity"
          :name="playerEntity.name"
          :hp="playerEntity.hp ?? 0"
          :max-hp="playerEntity.maxHp ?? 1"
          :portrait="playerEntity.portrait"
          :class-emblem="playerClass?.emblem"
          :class-color="playerClass?.color"
        />

        <!-- Weapon quick-slots -->
        <ActionBarWeapon
          :main-hand="playerEntity?.equipment?.mainHand"
          :off-hand="playerEntity?.equipment?.offHand"
        />

        <!-- Action grid + category tabs -->
        <ActionBarSlots
          :slots="slots"
          :active-category="activeCategory"
          @activate="activateSlot"
          @category-change="setCategory"
        />

        <!-- End Turn -->
        <ActionBarResources @end-turn="() => {}" />
      </div>
    </div>
  </div>
</template>
