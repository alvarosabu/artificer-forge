import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { usePortraitStore } from '../stores/portraits'
import { useModularArmor } from '../modular/useModularArmor'
import { usePortraitStudio } from './usePortraitStudio'
import { resolvePortraitBackground } from './portraitBackgrounds'
import { portraitSignature } from './portraitSignature'

// TEMP: persistent cache disabled while portrait framing is being calibrated, so
// every load re-bakes from the current settings instead of serving a stale image.
// Flip back to `true` once framing is locked in (and bump PORTRAIT_CACHE_VERSION).
const PORTRAIT_CACHE_ENABLED = false

export function usePortraitRenderer(entityId: MaybeRefOrGetter<string>) {
  const gameStore = useGameStore()
  const portraitStore = usePortraitStore()
  const studio = usePortraitStudio()

  const entity = computed(() => gameStore.getEntity(toValue(entityId)))
  const url = ref<string | undefined>()

  // Modular characters bake from their appearance recipe; armor visuals derive
  // from what's actually equipped (same source as the world renderer).
  const armorPieces = useModularArmor(entityId)

  // Everything that affects how the portrait LOOKS — deliberately excludes
  // position/hp/etc. updateEntity() replaces the whole entity object on every
  // mutation (incl. each movement tick), so watching the entity directly would
  // re-bake constantly. Keying off the signature string means the bake only
  // re-runs when the appearance genuinely changes.
  const appearance = computed(() => {
    const e = entity.value
    if (!e || e.type !== 'character' || (!e.model && !e.appearance)) return null
    const equipment = gameStore.derivedEquipment(e.id)
    const background = resolvePortraitBackground(e.portraitBackground)
    const armor = e.appearance ? armorPieces.value : undefined
    return {
      id: e.id,
      model: e.model,
      modular: e.appearance,
      armor,
      rig: e.rig ?? 'Rig_Medium',
      equipment,
      background,
      fallback: e.portrait,
      signature: portraitSignature({ model: e.model, appearance: e.appearance, armor, rig: e.rig, equipment, background }),
    }
  })

  watch(
    // A primitive key: the watcher fires only when the string changes, so moving
    // the character (same signature) never retriggers a bake.
    () => appearance.value?.signature,
    () => {
      const a = appearance.value

      // Non-characters or modelless entities: fall back to the authored portrait.
      if (!a) {
        url.value = entity.value?.portrait
        return
      }

      const cached = PORTRAIT_CACHE_ENABLED ? portraitStore.get(a.id) : undefined
      if (cached && cached.signature === a.signature) {
        url.value = cached.url
        return
      }

      // Auto-generated portrait is preferred. The authored `portrait` (or a stale
      // cached bake) is only a placeholder shown while the fresh one renders, or a
      // fallback if the bake fails.
      url.value = a.fallback ?? cached?.url

      studio
        .bake(`${a.id}:${a.signature}`, { model: a.model, appearance: a.modular, armor: a.armor, rig: a.rig, equipment: a.equipment, background: a.background })
        .then((dataUrl) => {
          if (PORTRAIT_CACHE_ENABLED) portraitStore.set(a.id, dataUrl, a.signature)
          url.value = dataUrl
        })
        .catch(() => {
          // Bake failed -> keep whatever fallback is in url.value.
        })
    },
    { immediate: true },
  )

  return { url }
}
