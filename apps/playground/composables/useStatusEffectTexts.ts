import type { ComputedRef } from 'vue'
import type { StatusEffectId } from '~/shared/statusEffectIds'

export interface StatusTextEntry {
  id: string
  label: string
  /** Tailwind text color class from the status definition (e.g. 'text-green-400'). */
  color: string
}

/** Queues a floating text entry above the character whenever it gains a status effect. */
export function useStatusEffectTexts(entityId: ComputedRef<string>) {
  const gameStore = useGameStore()
  const store = useStatusEffectStore()
  const texts = ref<StatusTextEntry[]>([])

  watch(
    () => gameStore.getEntity(entityId.value)?.statusEffects?.map(e => e.id) ?? [],
    (next, prev) => {
      const added = next.filter((id: StatusEffectId) => !prev.includes(id))
      for (const id of added) {
        const def = store.get(id)
        texts.value.push({
          id: crypto.randomUUID(),
          label: def?.label ?? id,
          color: def?.color ?? 'text-white',
        })
      }
    },
  )

  function removeText(id: string) {
    texts.value = texts.value.filter(t => t.id !== id)
  }

  onScopeDispose(() => {
    texts.value = []
  })

  return { texts, removeText }
}
