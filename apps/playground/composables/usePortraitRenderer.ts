import { portraitSignature } from '~/utils/portraitSignature'

export function usePortraitRenderer(entityId: MaybeRefOrGetter<string>) {
  const gameStore = useGameStore()
  const portraitStore = usePortraitStore()
  const studio = usePortraitStudio()

  const entity = computed(() => gameStore.getEntity(toValue(entityId)))
  const url = ref<string | undefined>()

  watchEffect(() => {
    const e = entity.value

    // Non-characters or modelless entities: nothing to render.
    if (!e || e.type !== 'character' || !e.model) {
      url.value = e?.portrait
      return
    }

    // Explicit hand-authored portrait wins.
    if (e.portrait) {
      url.value = e.portrait
      return
    }

    const equipment = gameStore.derivedEquipment(e.id)
    const signature = portraitSignature({ model: e.model, rig: e.rig, equipment })

    const cached = portraitStore.get(e.id)
    if (cached && cached.signature === signature) {
      url.value = cached.url
      return
    }

    // Show stale cached image (if any) while the new one bakes.
    url.value = cached?.url

    studio
      .bake(`${e.id}:${signature}`, { model: e.model, rig: e.rig ?? 'Rig_Medium', equipment })
      .then((dataUrl) => {
        portraitStore.set(e.id, dataUrl, signature)
        url.value = dataUrl
      })
      .catch(() => {
        // Bake failed -> keep whatever fallback is in url.value.
      })
  })

  return { url }
}
