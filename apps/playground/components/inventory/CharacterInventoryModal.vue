<!-- apps/playground/components/inventory/CharacterInventoryModal.vue -->
<script setup lang="ts">
import type { EntityState, EquipmentSlotKey } from '~/stores/game'

const { isOpen, focusedCharacter } = useInventory()

const character = computed(() => focusedCharacter.value)
const slots = computed(() => character.value?.equipmentSlots ?? [])
const slotSet = computed(() => new Set(slots.value))
const hasSlot = (k: EquipmentSlotKey) => slotSet.value.has(k)

const itemMenu = useItemContextMenu()

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
      content: 'bg-marine-950 bg-gradient-to-b from-marine-900 to-marine-950 border-2 border-gold-600/70 rounded-xl shadow-2xl shadow-black/50 sm:max-w-4xl',
      header: 'border-b border-gold-600/30',
      title: 'font-serif text-gold-200 text-lg',
    }"
  >
    <template #body>
      <div v-if="character" class="grid grid-cols-[320px_1fr] gap-4 min-h-[420px]">
        <!-- LEFT: doll + equipment -->
        <div class="flex flex-col gap-3">
          <!-- Helmet top row -->
          <div class="flex justify-center">
            <InventoryEquipmentSlot
              v-if="hasSlot('helmet')"
              slot-key="helmet"
              :character-id="character.id"
              @context="onEquipmentContext"
            />
          </div>

          <!-- Side slots flanking the doll -->
          <div class="grid grid-cols-[auto_1fr_auto] gap-3 items-stretch">
            <div class="flex flex-col gap-2">
              <InventoryEquipmentSlot
                v-if="hasSlot('armor')"
                slot-key="armor"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
              <InventoryEquipmentSlot
                v-if="hasSlot('gauntlets')"
                slot-key="gauntlets"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
              <InventoryEquipmentSlot
                v-if="hasSlot('boots')"
                slot-key="boots"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
            </div>

            <div class="min-h-[260px]">
              <InventoryCharacterPreview
                :key="character.id"
                :character-id="character.id"
              />
            </div>

            <div class="flex flex-col gap-2">
              <InventoryEquipmentSlot
                v-if="hasSlot('amulet')"
                slot-key="amulet"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
              <InventoryEquipmentSlot
                v-if="hasSlot('ring1')"
                slot-key="ring1"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
              <InventoryEquipmentSlot
                v-if="hasSlot('ring2')"
                slot-key="ring2"
                :character-id="character.id"
                @context="onEquipmentContext"
              />
            </div>
          </div>

          <!-- Weapons row -->
          <div class="flex justify-center gap-4 pt-2 border-t border-gold-600/30">
            <InventoryEquipmentSlot
              v-if="hasSlot('mainHand')"
              slot-key="mainHand"
              :character-id="character.id"
              @context="onEquipmentContext"
            />
            <InventoryEquipmentSlot
              v-if="hasSlot('offHand')"
              slot-key="offHand"
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
</template>
