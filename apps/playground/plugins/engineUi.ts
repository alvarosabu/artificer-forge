import {
  ActionBar,
  CharacterInventoryModal,
  DialogPanel,
  EntityContextMenu,
  ItemContextMenu,
  LootPopover,
  PartyPanel,
  StatusEffectBadge,
  StatusEffectBadges,
  WorldItem,
} from '@artificer-forge/engine/ui'

// The HUD widgets live in the engine /ui export now. Register the tag-used ones
// globally so existing template usage keeps working. Inventory components keep
// their old Nuxt directory-prefixed tag names (e.g. <InventoryWorldItem/>).
export default defineNuxtPlugin((nuxtApp) => {
  const register = nuxtApp.vueApp.component.bind(nuxtApp.vueApp) as (name: string, c: unknown) => void
  const components: Record<string, unknown> = {
    ActionBar,
    DialogPanel,
    EntityContextMenu,
    PartyPanel,
    StatusEffectBadge,
    StatusEffectBadges,
    InventoryCharacterInventoryModal: CharacterInventoryModal,
    InventoryItemContextMenu: ItemContextMenu,
    InventoryLootPopover: LootPopover,
    InventoryWorldItem: WorldItem,
  }
  for (const [name, c] of Object.entries(components)) register(name, c)
})
