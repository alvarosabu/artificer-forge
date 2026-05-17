<!-- apps/playground/components/inventory/CharacterInventoryModal.vue -->
<script setup lang="ts">
import type { EntityState } from '~/stores/game'

const { isOpen, focusedCharacter } = useInventory()

const character = computed(() => focusedCharacter.value)
const slots = computed(() => character.value?.equipmentSlots ?? [])

const itemMenu = useItemContextMenu()
// Top-level ref alias → auto-unwrapped in template
const menuGroups = itemMenu.menuGroups
const menuState = itemMenu.state

function onItemContext(event: MouseEvent, item: EntityState) {
  itemMenu.openAt(event, item.id)
}
function onEquipmentContext(event: MouseEvent, item: EntityState) {
  itemMenu.openAt(event, item.id)
}
function onItemClick(_item: EntityState) {}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="character?.name ?? 'Inventory'"
    :ui="{
      content: 'bg-gradient-to-b from-marine-900/95 to-purple-800/40 border-2 border-gold-600/70 rounded-xl shadow-2xl shadow-black/50 sm:max-w-4xl',
      header: 'border-b border-gold-600/30',
      title: 'font-serif text-gold-200 text-lg',
    }"
  >
    <template #body>
      <div v-if="character" class="grid grid-cols-[280px_1fr] gap-4 min-h-[420px]">
        <!-- LEFT: doll + equipment -->
        <div class="flex flex-col gap-3">
          <div class="flex-1 min-h-[300px]">
            <InventoryCharacterDoll
              :key="character.id"
              :character-id="character.id"
            />
          </div>
          <div class="flex justify-center gap-3 py-2 border-t border-gold-600/30">
            <InventoryEquipmentSlot
              v-for="slot in slots"
              :key="slot"
              :slot-key="slot"
              :character-id="character.id"
              @context="onEquipmentContext"
            />
          </div>
        </div>

        <!-- RIGHT: bag + weight -->
        <div class="flex flex-col">
          <InventoryBagGrid
            :character-id="character.id"
            @item-click="onItemClick"
            @item-context="onItemContext"
          />
        </div>
      </div>
    </template>
  </UModal>

  <div
    v-if="menuState.open && menuGroups.length"
    class="fixed z-[60]"
    :style="{ left: `${menuState.x}px`,
              top: `${menuState.y}px` }"
  >
    <UDropdownMenu
      v-model:open="menuState.open"
      :items="menuGroups"
    >
      <template #default>
        <span class="sr-only">Item context menu trigger</span>
      </template>
    </UDropdownMenu>
  </div>
</template>
