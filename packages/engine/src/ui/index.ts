// @artificer-forge/engine/ui — HUD widgets (Nuxt UI based), skinnable via the `:ui` prop.
// Requires the consuming app to install @nuxt/ui (optional peer of the engine).

// Interaction composables
export * from './useItemContextMenu'
export * from './useItemDrag'
export * from './useEntityActions'

// Scene host — TresCanvas + renderer + systems + post-processing + HUD overlay
export { default as Game } from './components/Game.vue'

// Action bar
export { default as ActionBar } from './components/ActionBar.vue'
export { default as ActionBarPortrait } from './components/ActionBarPortrait.vue'
export { default as ActionBarResources } from './components/ActionBarResources.vue'
export { default as ActionBarSlots } from './components/ActionBarSlots.vue'
export { default as ActionBarTabs } from './components/ActionBarTabs.vue'
export { default as ActionBarWeapon } from './components/ActionBarWeapon.vue'
export { default as ActionPointsGroup } from './components/ActionPointsGroup.vue'

// Panels / dialog / context menu / status
export { default as CharacterPanel } from './components/CharacterPanel.vue'
export { default as PartyPanel } from './components/PartyPanel.vue'
export { default as DialogPanel } from './components/DialogPanel.vue'
export { default as EntityContextMenu } from './components/EntityContextMenu.vue'

// Inventory
export { default as BagGrid } from './components/inventory/BagGrid.vue'
export { default as CharacterInventoryModal } from './components/inventory/CharacterInventoryModal.vue'
export { default as CharacterPreview } from './components/inventory/CharacterPreview.vue'
export { default as CharacterPreviewModel } from './components/inventory/CharacterPreviewModel.vue'
export { default as EquipmentSlot } from './components/inventory/EquipmentSlot.vue'
export { default as ItemCell } from './components/inventory/ItemCell.vue'
export { default as ItemContextMenu } from './components/inventory/ItemContextMenu.vue'
export { default as ItemTooltip } from './components/inventory/ItemTooltip.vue'
export { default as LootPopover } from './components/inventory/LootPopover.vue'
export { default as PortraitDropZone } from './components/inventory/PortraitDropZone.vue'
export { default as WeightBar } from './components/inventory/WeightBar.vue'
export { default as WorldItem } from './components/inventory/WorldItem.vue'
