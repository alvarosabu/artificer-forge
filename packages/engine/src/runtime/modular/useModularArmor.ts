import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { ModularSlot } from '../../core/appearance'
import { useGameStore } from '../stores/game'
import type { ArmorPiece } from './useModularRig'

const MODULAR_SLOTS: ModularSlot[] = ['helmet', 'armor', 'cloak', 'trousers', 'gauntlets', 'boots']

const warned = new Set<string>()

// Armor visuals derive from what the entity ACTUALLY has equipped — the item
// YAML (modular.assets/hides, texture.tints) is the source of truth, and the
// appearance only contributes the cosmetic tint choice per slot. Reactive:
// equip/unequip re-derives the pieces and the rig re-syncs.
export function useModularArmor(entityId: MaybeRefOrGetter<string>): ComputedRef<ArmorPiece[]> {
  const gameStore = useGameStore()

  return computed(() => {
    const id = toValue(entityId)
    const entity = gameStore.getEntity(id)
    if (!entity) return []

    const pieces: ArmorPiece[] = []
    for (const slot of MODULAR_SLOTS) {
      const item = gameStore.equippedAt(id, slot)
      const mod = item?.modular
      if (!item || !mod) continue

      const path = (entity.sex && mod.assets?.[entity.sex]) ?? mod.assets?.any
      if (!path) {
        const key = `${item.templateId}:${entity.sex ?? '-'}`
        if (!warned.has(key)) {
          warned.add(key)
          console.warn(`[useModularArmor] No fitted asset for item ${item.templateId} (sex: ${entity.sex ?? 'unset'}) — piece not rendered.`)
        }
        continue
      }

      const tintId = entity.appearance?.equipmentTint?.[slot]
      const tint = tintId ? item.texture?.tints?.find(t => t.id === tintId)?.map ?? null : null

      pieces.push({
        // Part id = filename stem, same convention as the part manifest.
        id: path.split('/').pop()!.replace(/\.glb$/, ''),
        path,
        hides: mod.hides ?? [],
        tint,
      })
    }
    return pieces
  })
}
