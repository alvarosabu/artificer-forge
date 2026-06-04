import type { EntityState } from '~/stores/game'

// === Types ===

export interface DialogContext {
  speaker: EntityState | null
  player: EntityState | null
  partyEntities: EntityState[]
  gameStore: ReturnType<typeof useGameStore>
}

export interface DialogCheck {
  skill: string
  dc: number
  advantage?: boolean
}

export interface DialogChoice {
  text: string
  tagPrefix?: string
  conditions?: Record<string, unknown>[]
  check?: DialogCheck
  next?: string
  onSuccess?: { next?: string, effects?: Record<string, unknown>[] }
  onFailure?: { next?: string, effects?: Record<string, unknown>[] }
  effects?: Record<string, unknown>[]
  lockedDisplay?: 'hide' | 'lock'
}

export interface DialogNode {
  speaker?: string
  text: string
  textVariants?: { if: Record<string, unknown>, text: string }[]
  cameraShot?: 'three-quarter' | 'over-shoulder' | 'closeup' | 'wide' | 'two-shot'
  cameraTarget?: string
  choices?: DialogChoice[]
  effects?: Record<string, unknown>[]
}

export interface ResolvedChoice {
  index: number
  raw: DialogChoice
  text: string
  available: boolean
  lockedReason?: string
  hide: boolean
}

export interface CheckRoll {
  skill: string
  dc: number
  roll: number
  modifier: number
  total: number
  success: boolean
}

// === Skill → stat mapping (D&D 5e style) ===

const SKILL_TO_STAT: Record<string, string> = {
  athletics: 'strength',
  acrobatics: 'dexterity',
  'sleight-of-hand': 'dexterity',
  stealth: 'dexterity',
  arcana: 'intelligence',
  history: 'intelligence',
  investigation: 'intelligence',
  nature: 'intelligence',
  religion: 'intelligence',
  'animal-handling': 'wisdom',
  insight: 'wisdom',
  medicine: 'wisdom',
  perception: 'wisdom',
  survival: 'wisdom',
  deception: 'charisma',
  intimidation: 'charisma',
  performance: 'charisma',
  persuasion: 'charisma',
}

function statModifier(stat: number): number {
  return Math.floor((stat - 10) / 2)
}

// === Condition evaluation ===

function evalCompare(value: number, cmp: Record<string, unknown>): boolean {
  for (const [op, threshold] of Object.entries(cmp)) {
    const t = Number(threshold)
    if (op === 'gte' && !(value >= t)) return false
    if (op === 'lte' && !(value <= t)) return false
    if (op === 'gt' && !(value > t)) return false
    if (op === 'lt' && !(value < t)) return false
    if (op === 'eq' && !(value === t)) return false
  }
  return true
}

export function evaluateCondition(condition: Record<string, unknown>, ctx: DialogContext): boolean {
  for (const [key, value] of Object.entries(condition)) {
    switch (key) {
      case 'flag': {
        // { flag: { name: expectedValue } } or { flag: 'name' } (truthy)
        if (typeof value === 'string') {
          if (!ctx.gameStore.hasFlag(value)) return false
        }
        else if (value && typeof value === 'object') {
          for (const [flagName, expected] of Object.entries(value as Record<string, unknown>)) {
            const actual = ctx.gameStore.getFlag(flagName)
            if (actual !== expected) return false
          }
        }
        break
      }
      case 'notFlag': {
        const name = String(value)
        if (ctx.gameStore.hasFlag(name)) return false
        break
      }
      case 'class':
        if (ctx.player?.class !== value) return false
        break
      case 'race':
        if (ctx.player?.race !== value) return false
        break
      case 'faction':
        if (ctx.player?.faction !== value) return false
        break
      case 'hasAbility':
        if (!ctx.player?.abilities?.includes(String(value))) return false
        break
      case 'hasStatusEffect':
        if (!ctx.player?.statusEffects?.some(e => e.id === value)) return false
        break
      case 'stat': {
        // { stat: { strength: { gte: 14 } } }
        const stats = ctx.player?.stats ?? {}
        for (const [statName, cmp] of Object.entries(value as Record<string, Record<string, unknown>>)) {
          const v = stats[statName] ?? 0
          if (!evalCompare(v, cmp)) return false
        }
        break
      }
      case 'partyHas': {
        // { partyHas: 'cleric' } — match by class or templateId
        const needle = String(value)
        const found = ctx.partyEntities.some(e => e.class === needle || e.templateId === needle)
        if (!found) return false
        break
      }
      case 'hasItem': {
        // { hasItem: { id: 'gold', qty: 10 } }
        const { id, qty = 1 } = value as { id: string, qty?: number }
        if (!ctx.player) return false
        const items = ctx.gameStore.itemsIn(ctx.player.id, { includeEquipped: true })
        const total = items
          .filter(i => i.templateId === id)
          .reduce((sum, i) => sum + (i.quantity ?? 1), 0)
        if (total < qty) return false
        break
      }
      default:
        console.warn(`[dialog] unknown condition key: ${key}`)
        return false
    }
  }
  return true
}

export function evaluateConditions(
  conditions: Record<string, unknown>[] | undefined,
  ctx: DialogContext,
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(c => evaluateCondition(c, ctx))
}

function describeFailedCondition(condition: Record<string, unknown>): string {
  const [key, value] = Object.entries(condition)[0] ?? ['', '']
  switch (key) {
    case 'class': return `Requires ${value}`
    case 'race': return `Requires ${value}`
    case 'faction': return `Requires ${value} faction`
    case 'hasAbility': return `Requires ability: ${value}`
    case 'hasStatusEffect': return `Requires status: ${value}`
    case 'stat': {
      const [statName, cmp] = Object.entries(value as Record<string, Record<string, unknown>>)[0] ?? ['', {}]
      const [op, t] = Object.entries(cmp)[0] ?? ['', 0]
      const opLabel = op === 'gte' ? '≥' : op === 'lte' ? '≤' : op === 'gt' ? '>' : op === 'lt' ? '<' : '='
      return `${statName} ${opLabel} ${t}`
    }
    case 'hasItem': {
      const { id, qty = 1 } = value as { id: string, qty?: number }
      return `Need ${qty}× ${id}`
    }
    case 'partyHas': return `Need ${value} in party`
    case 'flag': return `Story requirement`
    case 'notFlag': return `Story requirement`
    default: return key
  }
}

// === Text resolution ===

export function resolveText(node: DialogNode, ctx: DialogContext): string {
  if (node.textVariants) {
    for (const variant of node.textVariants) {
      if (evaluateCondition(variant.if, ctx)) return variant.text
    }
  }
  return node.text
}

// === Choice resolution ===

export function availableChoices(node: DialogNode, ctx: DialogContext): ResolvedChoice[] {
  const choices = node.choices ?? []
  return choices.map((choice, index) => {
    let available = true
    let lockedReason: string | undefined

    if (choice.conditions && choice.conditions.length > 0) {
      const failed = choice.conditions.find(c => !evaluateCondition(c, ctx))
      if (failed) {
        available = false
        lockedReason = describeFailedCondition(failed)
      }
    }

    return {
      index,
      raw: choice,
      text: choice.text,
      available,
      lockedReason,
      hide: !available && choice.lockedDisplay === 'hide',
    }
  })
}

// === Skill check ===

export function rollCheck(check: DialogCheck, ctx: DialogContext): CheckRoll {
  const statName = SKILL_TO_STAT[check.skill] ?? check.skill
  const statValue = ctx.player?.stats?.[statName] ?? 10
  const modifier = statModifier(statValue)
  const d1 = 1 + Math.floor(Math.random() * 20)
  const d2 = check.advantage ? 1 + Math.floor(Math.random() * 20) : d1
  const roll = Math.max(d1, d2)
  const total = roll + modifier
  return {
    skill: check.skill,
    dc: check.dc,
    roll,
    modifier,
    total,
    success: total >= check.dc,
  }
}

// === Effect application ===

export function applyEffects(
  effects: Record<string, unknown>[] | undefined,
  ctx: DialogContext,
): { endDialog?: boolean } {
  if (!effects) return {}
  let endDialog = false
  for (const effect of effects) {
    for (const [key, payload] of Object.entries(effect)) {
      switch (key) {
        case 'setFlag': {
          for (const [name, value] of Object.entries(payload as Record<string, boolean | number>)) {
            ctx.gameStore.setFlag(name, value)
          }
          break
        }
        case 'clearFlag': {
          const name = String(payload)
          // Unset the flag entirely so getFlag returns undefined (not false).
          ctx.gameStore.clearFlag(name)
          break
        }
        case 'addStatusEffect': {
          const { entity, id } = payload as { entity?: 'player' | 'speaker', id: string }
          const target = entity === 'speaker' ? ctx.speaker?.id : ctx.player?.id
          if (target) ctx.gameStore.addStatusEffect(target, id as never)
          break
        }
        case 'removeStatusEffect': {
          const { entity, id } = payload as { entity?: 'player' | 'speaker', id: string }
          const target = entity === 'speaker' ? ctx.speaker?.id : ctx.player?.id
          if (target) ctx.gameStore.removeStatusEffect(target, id as never)
          break
        }
        case 'learnAbility': {
          const id = String(payload)
          if (ctx.player) ctx.gameStore.learnAbility(ctx.player.id, id)
          break
        }
        case 'giveItem': {
          const { id, qty = 1 } = payload as { id: string, qty?: number }
          if (ctx.player) {
            ctx.gameStore.spawnItemEntity(id, { containerId: ctx.player.id, quantity: qty })
          }
          break
        }
        case 'takeItem': {
          const { id, qty = 1 } = payload as { id: string, qty?: number }
          if (!ctx.player) break
          let remaining = qty
          const items = ctx.gameStore.itemsIn(ctx.player.id, { includeEquipped: true })
            .filter(i => i.templateId === id)
          for (const item of items) {
            if (remaining <= 0) break
            const have = item.quantity ?? 1
            if (have <= remaining) {
              ctx.gameStore.removeEntity(item.id)
              remaining -= have
            }
            else {
              ctx.gameStore.updateEntity(item.id, { quantity: have - remaining })
              remaining = 0
            }
          }
          break
        }
        case 'endDialog':
          endDialog = true
          break
        default:
          console.warn(`[dialog] unknown effect key: ${key}`)
      }
    }
  }
  return { endDialog }
}

export function useDialogEngine() {
  const gameStore = useGameStore()

  function buildContext(speakerId: string | null): DialogContext {
    const playerId = gameStore.party.leader
    const player = playerId ? gameStore.entities.get(playerId) ?? null : null
    const speaker = speakerId ? gameStore.entities.get(speakerId) ?? null : null
    const partyEntities = gameStore.partyEntities
    return { player, speaker, partyEntities, gameStore }
  }

  return {
    buildContext,
    evaluateConditions,
    resolveText,
    availableChoices,
    rollCheck,
    applyEffects,
  }
}
