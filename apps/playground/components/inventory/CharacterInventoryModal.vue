<!-- apps/playground/components/inventory/CharacterInventoryModal.vue -->
<script setup lang="ts">
import type { EntityState, EquipmentSlotKey } from '~/stores/game'

const { isOpen, focusedCharacter } = useInventory()
const gameStore = useGameStore()

const character = computed(() => focusedCharacter.value)
const slots = computed(() => character.value?.equipmentSlots ?? [])
const slotSet = computed(() => new Set(slots.value))
const hasSlot = (k: EquipmentSlotKey) => slotSet.value.has(k)

const maxArmor = computed(() =>
  character.value ? gameStore.derivedMaxArmor(character.value.id) : { physical: 0, magical: 0 },
)

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
      <div v-if="character" class="flex flex-col gap-3">
        
        <div class="grid grid-cols-[320px_1fr] gap-4 min-h-[420px]">
        <!-- LEFT: preview fills entire background, all equipment slots overlay on top -->
        <div class="relative rounded overflow-hidden min-h-[460px]">
          <InventoryCharacterPreview
            :key="character.id"
            :character-id="character.id"
            class="absolute inset-0"
          />

          <!-- Stats pills: very top -->
          <div class="absolute top-2 left-2 right-2 flex items-center justify-center gap-2 z-10 pointer-events-none">
            <div class="flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
              <UIcon name="ph:heart-fill" class="size-4 text-red-400" />
              <span class="text-sm font-bold text-red-300 font-serif">{{ character.hp }} / {{ character.maxHp }}</span>
            </div>
            <div v-if="maxArmor.physical > 0" class="flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
              <UIcon name="ph:shield-fill" class="size-4 text-white" />
              <span class="text-sm font-bold text-white font-serif">{{ character.physicalArmor ?? 0 }} / {{ maxArmor.physical }}</span>
            </div>
            <div v-if="maxArmor.magical > 0" class="flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
              <UIcon name="ph:shield-star-fill" class="size-4 text-blue-400" />
              <span class="text-sm font-bold text-blue-400 font-serif">{{ character.magicalArmor ?? 0 }} / {{ maxArmor.magical }}</span>
            </div>
          </div>

          <!-- Helmet: top center, above the armor/amulet row -->
          <div v-if="hasSlot('helmet')" class="absolute top-12 left-1/2 -translate-x-1/2 z-10">
            <InventoryEquipmentSlot
              slot-key="helmet"
              :character-id="character.id"
              @context="onEquipmentContext"
            />
          </div>

          <!-- Left column: body armor — starts below helmet -->
          <div class="absolute left-2 top-28 flex flex-col gap-2 z-10">
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

          <!-- Right column: accessories — starts below helmet -->
          <div class="absolute right-2 top-28 flex flex-col gap-2 z-10">
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

          <!-- Weapons: bottom center -->
          <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 z-10">
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
      </div>
    </template>
  </UModal>
</template>
