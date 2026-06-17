<script setup lang="ts">
import { useContextMenu } from '@artificer-forge/engine/runtime'
import ActionBar from './ActionBar.vue'
import DialogPanel from './DialogPanel.vue'
import EntityContextMenu from './EntityContextMenu.vue'
import CharacterInventoryModal from './inventory/CharacterInventoryModal.vue'
import ItemContextMenu from './inventory/ItemContextMenu.vue'
import LootPopover from './inventory/LootPopover.vue'

// The 2D DOM overlay layer — everything rendered on top of the canvas.
// Self-wires the entity context menu from the provider set up by <Game>.
const { state, emitAction } = useContextMenu()
</script>

<template>
  <EntityContextMenu
    :state="state"
    @update:open="state.open = $event"
    @action="emitAction"
  />
  <ActionBar />
  <CharacterInventoryModal />
  <LootPopover />
  <ItemContextMenu />
  <DialogPanel />
</template>
