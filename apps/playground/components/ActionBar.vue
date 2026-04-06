<script setup lang="ts">
const { playerEntity, playerClassId, slots, activeCategory, setCategory, activateSlot, activeWeaponSlot, setActiveWeaponSlot } = useActionBar()

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
    <div class="flex items-center justify-center pb-4 px-4 pointer-events-auto gap-3">
      <!-- Portrait — outside the card -->
      <ActionBarPortrait
        v-if="playerEntity"
        :name="playerEntity.name"
        :hp="playerEntity.hp ?? 0"
        :max-hp="playerEntity.maxHp ?? 1"
        :portrait="playerEntity.portrait"
        :class-emblem="playerClass?.emblem"
        :class-color="playerClass?.color"
      />

      <!-- Weapon slots — outside the card -->
      <ActionBarWeapon
        :main-hand="playerEntity?.equipment?.mainHand"
        :off-hand="playerEntity?.equipment?.offHand"
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
