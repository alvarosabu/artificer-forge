import { ref } from 'vue'
// @ts-expect-error - virtual imports resolved by Nuxt at runtime
import { queryCollection, useRuntimeConfig } from '#imports'

interface Source { collection: string, field: string, where?: Record<string, unknown> }

// Tabletop RPG skills (mirror SKILL_TO_STAT keys in the playground dialog engine).
const SKILLS_DEFAULT = [
  'athletics', 'acrobatics', 'sleight-of-hand', 'stealth', 'arcana', 'history',
  'investigation', 'nature', 'religion', 'animal-handling', 'insight', 'medicine',
  'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion',
]

export function useAutocomplete() {
  const cfg = (useRuntimeConfig().public.dialogEditor?.autocomplete ?? {}) as {
    skills?: string[]
    items?: Source
    abilities?: Source
    statusEffects?: Source
    classes?: Source
  }

  const items = ref<string[]>([])
  const abilities = ref<string[]>([])
  const statusEffects = ref<string[]>([])
  const classes = ref<string[]>([])
  const skills = cfg.skills ?? SKILLS_DEFAULT

  async function loadSource(src: Source | undefined, target: typeof items) {
    if (!src) return
    try {
      let q = queryCollection(src.collection)
      for (const [k, v] of Object.entries(src.where ?? {})) q = q.where(k, '=', v)
      const rows = await q.all()
      target.value = [...new Set(rows.map((r: Record<string, unknown>) => r[src.field]).filter(Boolean))] as string[]
    }
    catch (err) {
      console.warn(`[dialog-editor] autocomplete source "${src.collection}" failed`, err)
    }
  }

  async function load() {
    await Promise.all([
      loadSource(cfg.items, items),
      loadSource(cfg.abilities, abilities),
      loadSource(cfg.statusEffects, statusEffects),
      loadSource(cfg.classes, classes),
    ])
  }

  return { items, abilities, statusEffects, classes, skills, load }
}
