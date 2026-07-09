import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { carryCapacity, computeDamage, deriveMaxArmor, encumbrance, totalWeight, type CharacterAppearance, type ModularSlot, type Sex } from '@artificer-forge/engine/core'
import { useDamageTypeStore } from './damageTypes'

// Types
export interface Position {
  x: number
  y: number
  z: number
}

export interface Equipment {
  mainHand?: string
  offHand?: string
}

export interface ContainerInfo {
  // Optional weight capacity (kg). Undefined => unlimited (chests, corpses).
  capacity?: number
}

// Slot keys for character equipment.
export type EquipmentSlotKey =
  | 'mainHand'
  | 'offHand'
  | 'helmet'
  | 'armor'
  | 'cloak'
  | 'trousers'
  | 'gauntlets' 
  | 'boots'
  | 'amulet'
  | 'ring1'
  | 'ring2'

export const ALL_EQUIPMENT_SLOTS: EquipmentSlotKey[] = [
  'helmet',
  'amulet',
  'armor',
  'cloak',
  'trousers',
  'gauntlets',
  'boots',
  'ring1',
  'ring2',
  'mainHand',
  'offHand',
]

export type { StatusEffectId } from '../../core/statusEffects'

export interface StatusEffect {
  id: StatusEffectId
  turnsLeft?: number
}

export type Team = 'player' | 'ally' | 'neutral' | 'hostile'

export interface EntityState {
  id: string
  templateId: string
  type: 'character' | 'item' | 'interactable'
  subtype?: string
  name: string
  position: Position
  rotation?: Position
  moveTarget?: Position | null
  
  // Rendering
  portrait?: string
  portraitBackground?: string
  icon?: string
  model?: string
  rig?: string
  animations?: Record<string, unknown>
  
  // Character-specific
  class?: string
  level?: number
  race?: string
  sex?: Sex
  // Modular cosmetics — presence switches rendering to modular assembly.
  appearance?: CharacterAppearance
  faction?: string
  team?: Team
  controllable?: boolean
  recruitable?: boolean
  hp?: number
  maxHp?: number
  // Current armor pools (depleting). Max is derived from equipped items via derivedMaxArmor.
  physicalArmor?: number
  magicalArmor?: number
  stats?: Record<string, number>
  ai?: {
    behavior: string
    [key: string]: unknown
  }

  // Interactable-specific
  locked?: boolean
  opened?: boolean
  destructible?: boolean

  // Character-specific lifecycle
  dead?: boolean

  // Status effects
  statusEffects?: StatusEffect[]

  // Abilities
  abilities?: string[]

  // Dialog
  dialogId?: string

  // NEW — container annotation (characters, chests, corpses)
  container?: ContainerInfo
  equipmentSlots?: EquipmentSlotKey[]

  // NEW — item-instance fields (only meaningful when type === 'item')
  containerId?: string | null    // owning entity id, or null = in world
  slot?: EquipmentSlotKey        // when equipped, names the slot
  quantity?: number              // for stackables
  stackable?: boolean
  maxStack?: number
  weight?: number                // per unit (kg)

  // Item template metadata copied from YAML at spawn
  // Modular equip rendering: which body segments the piece hides when worn and
  // the fitted mesh per body sex (`any` = unisex). See useModularArmor.
  modular?: { slot: ModularSlot, hides: string[], assets?: Partial<Record<Sex | 'any', string>> }
  // Palette-atlas tinting: base atlas + alternate recolored atlases.
  texture?: { base: string, tints?: { id: string, label: string, map: string }[] }
  damage?: { dice: string, type: string }
  armor?: { physical?: number, magical?: number }
  properties?: string[]
  range?: { normal: number, long: number }
  effect?: { type: string, dice?: string, bonus?: number }
  value?: number
  usable?: boolean
}

export type MoveFailReason =
  | 'no-slot'
  | 'wrong-type'
  | 'over-capacity'
  | 'occupied'
  | 'not-found'
  | 'invalid-target'

export type MoveResult =
  | { ok: true }
  | { ok: false, reason: MoveFailReason }

/** Loosely-typed entity template — the app guarantees the shape via its content source. */
export interface EntityTemplate {
  templateId: string
  type: EntityState['type']
  [key: string]: any
}

export interface SceneDef {
  sceneId: string
  entities: Array<{ templateId: string, position: Position, rotation?: Position, overrides?: Partial<EntityState> }>
  spawnPoints: Record<string, unknown>
}

/**
 * Minimal class-template shape the engine UI consumes (the ActionBar emblem and
 * accent colour). Apps own the full schema and may attach arbitrary extra fields
 * — hence the open index signature — but these are what the engine itself reads.
 */
export interface ClassTemplate {
  emblem?: string
  color?: string
  [key: string]: unknown
}

/**
 * Content source injected by the app — the engine never fetches content itself
 * (no Nuxt Content / queryCollection coupling). Wire this once at app init via
 * `useGameStore().configureContent(...)`.
 */
export interface ContentSource {
  resolveTemplate: (templateId: string) => Promise<EntityTemplate | null>
  resolveScene: (sceneId: string) => Promise<SceneDef | null>
  // Loosely typed (app-provided content); ability/dialog consumers cast to their own shapes.
  resolveAbility: (abilityId: string) => Promise<any | null>
  resolveDialog: (dialogId: string) => Promise<any | null>
  resolveClass: (classId: string) => Promise<ClassTemplate | null>
}

const DEFAULT_ABILITIES = ['melee-attack', 'dash', 'throw']

export const useGameStore = defineStore('game', () => {
  // === CONTENT SOURCE (app-injected) ===
  let content: ContentSource | null = null
  function configureContent(source: ContentSource) {
    content = source
  }
  function requireContent(): ContentSource {
    if (!content) {
      throw new Error('[game] content source not configured — call useGameStore().configureContent() at app init')
    }
    return content
  }

  /** Public gateways to the injected content source, for other engine systems. */
  function resolveTemplate(templateId: string): Promise<EntityTemplate | null> {
    return requireContent().resolveTemplate(templateId)
  }
  function resolveAbility(abilityId: string): Promise<any | null> {
    return requireContent().resolveAbility(abilityId)
  }
  function resolveDialog(dialogId: string): Promise<any | null> {
    return requireContent().resolveDialog(dialogId)
  }
  function resolveClass(classId: string): Promise<ClassTemplate | null> {
    return requireContent().resolveClass(classId)
  }

  // === WORLD STATE ===
  const currentScene = ref<string>('main')
  const worldFlags = ref<Record<string, boolean | number>>({})

  // === ENTITIES ===
  const entities = ref<Map<string, EntityState>>(new Map())

  // === PARTY ===
  const party = reactive({
    members: [] as string[],
    leader: null as string | null,
  })

  // === SELECTION ===
  const selectedEntityId = ref<string | null>(null)

  // === INPUT ===
  // Set by modal/dialog systems to suspend world input (movement, OrbitControls).
  const inputBlocked = ref(false)

  // --- Entity Actions ---

  function spawnEntity(id: string, state: EntityState) {
    entities.value.set(id, state)
  }

  function updateEntity(id: string, partial: Partial<EntityState>) {
    const entity = entities.value.get(id)
    if (entity) {
      entities.value.set(id, { ...entity, ...partial })
    }
  }

  function removeEntity(id: string) {
    entities.value.delete(id)
    // Also remove from party if present
    const partyIdx = party.members.indexOf(id)
    if (partyIdx > -1) {
      party.members.splice(partyIdx, 1)
    }
  }

  function getEntity(id: string) {
    return entities.value.get(id)
  }

  // Spawn a standalone item entity from an item template.
  async function spawnItemEntity(
    templateId: string,
    opts: {
      containerId?: string | null
      slot?: EquipmentSlotKey
      position?: Position
      quantity?: number
    },
  ): Promise<string | null> {
    const template = await requireContent().resolveTemplate(templateId)
    if (!template || template.type !== 'item') {
      console.warn(`[spawnItemEntity] item template not found or wrong type: ${templateId}`)
      return null
    }

    const id = `${template.templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const itemState: EntityState = {
      id,
      templateId: template.templateId,
      type: 'item',
      subtype: template.subtype,
      name: template.name,
      position: opts.position ?? { x: 0, y: 0, z: 0 },
      icon: template.icon,
      model: template.model,
      containerId: opts.containerId ?? null,
      slot: opts.slot,
      quantity: opts.quantity ?? 1,
      stackable: template.stackable ?? false,
      maxStack: template.maxStack ?? 1,
      weight: template.weight ?? 0,
      modular: template.modular,
      texture: template.texture,
      damage: template.damage,
      armor: template.armor,
      properties: template.properties,
      range: template.range,
      effect: template.effect,
      value: template.value,
      usable: template.usable,
    }

    spawnEntity(id, itemState)
    return id
  }

  // Spawn from a content template by templateId
  async function spawnFromTemplate(
    templateId: string,
    position: Position,
    overrides?: Partial<EntityState>,
  ): Promise<string> {
    const template = await requireContent().resolveTemplate(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const instanceId = `${template.templateId}_${Date.now()}`

    const entityState: EntityState = {
      id: instanceId,
      templateId: template.templateId,
      type: template.type,
      subtype: template.subtype,
      name: template.name,
      position,
      portrait: template.portrait,
      portraitBackground: template.portraitBackground,
      model: template.model,
      rig: template.rig,
      animations: template.animations,
      class: template.class,
      level: template.level,
      race: template.race,
      sex: template.sex,
      appearance: template.appearance,
      faction: template.faction,
      team: template.team ?? 'neutral',
      controllable: template.controllable,
      recruitable: template.recruitable,
      hp: template.stats?.hp ?? template.hp,
      maxHp: template.stats?.maxHp ?? template.maxHp,
      stats: template.stats,
      ai: template.ai,
      locked: template.locked,
      destructible: template.destructible,
      equipmentSlots: template.equipmentSlots,
      abilities: [...DEFAULT_ABILITIES, ...(template.abilities ?? [])],
      statusEffects: [],
      dialogId: template.dialogId,
      ...overrides,
    }

    spawnEntity(instanceId, entityState)

    // Spawn starting equipment as item entities reparented to this character.
    if (template.equipment && entityState.type === 'character') {
      for (const slot of ALL_EQUIPMENT_SLOTS) {
        const itemTemplateId = (template.equipment as Record<string, string | undefined>)[slot]
        if (!itemTemplateId) continue
        await spawnItemEntity(itemTemplateId, { containerId: instanceId, slot })
      }
      // Fill armor pools to the max derived from the freshly equipped gear.
      refreshArmor(instanceId)
    }

    // Spawn loot table items as item entities reparented to this interactable.
    if (template.lootTable && entityState.type === 'interactable') {
      for (const entry of template.lootTable) {
        const roll = Math.random()
        if (roll > entry.chance) continue
        let qty = 1
        if (Array.isArray(entry.quantity)) {
          const min = entry.quantity[0] ?? 1
          const max = entry.quantity[1] ?? min
          qty = Math.floor(min + Math.random() * (max - min + 1))
        }
        else if (typeof entry.quantity === 'number') {
          qty = entry.quantity
        }
        await spawnItemEntity(entry.id, { containerId: instanceId, quantity: qty })
      }
    }

    return instanceId
  }

  // --- Scene Actions ---

  async function loadScene(sceneId: string, spawnPointId: string = 'default') {
    const scene = await requireContent().resolveScene(sceneId)

    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`)
    }

    // Clear only NON-party entities — but keep items owned by party members
    for (const [id, entity] of entities.value) {
      if (party.members.includes(id)) continue
      if (entity.type === 'item' && entity.containerId && party.members.includes(entity.containerId)) continue
      entities.value.delete(id)
    }

    currentScene.value = sceneId

    // Spawn scene entities
    for (const entry of scene.entities) {
      await spawnFromTemplate(
        entry.templateId,
        entry.position,
        {
          rotation: entry.rotation,
          ...entry.overrides,
        },
      )
    }

    const spawnPoint = scene.spawnPoints[spawnPointId]
      ?? scene.spawnPoints.default

    return { scene, spawnPoint }
  }

  // --- Party Actions ---

  function addToParty(entityId: string) {
    if (!party.members.includes(entityId)) {
      party.members.push(entityId)
      if (!party.leader) {
        party.leader = entityId
      }
    }
  }

  function removeFromParty(entityId: string) {
    const idx = party.members.indexOf(entityId)
    if (idx > -1) {
      party.members.splice(idx, 1)
      if (party.leader === entityId) {
        party.leader = party.members[0] ?? null
      }
    }
  }

  function recruitEntity(entityId: string) {
    const entity = entities.value.get(entityId)
    if (!entity || !entity.recruitable || party.members.includes(entityId)) return
    updateEntity(entityId, {
      team: 'player',
      controllable: true,
      ai: { behavior: 'companion' },
      subtype: undefined,
    })
    addToParty(entityId)
  }

  function dismissEntity(entityId: string) {
    const entity = entities.value.get(entityId)
    if (!entity || !entity.recruitable || !party.members.includes(entityId)) return
    removeFromParty(entityId)
    updateEntity(entityId, {
      team: 'neutral',
      controllable: false,
      ai: { behavior: 'idle' },
      subtype: 'npc',
    })
  }

  function setPartyLeader(entityId: string) {
    if (party.members.includes(entityId)) {
      party.leader = entityId
    }
  }

  // --- Selection Actions ---

  function selectEntity(entityId: string | null) {
    selectedEntityId.value = entityId
    // Selecting a party member also makes them the active leader so the action
    // bar and ability system (both keyed off party.leader) follow the character
    // the user just took control of. setPartyLeader no-ops for non-party ids.
    if (entityId) setPartyLeader(entityId)
  }

  // --- Flag Actions ---

  function setFlag(key: string, value: boolean | number) {
    worldFlags.value[key] = value
  }

  function getFlag(key: string): boolean | number | undefined {
    return worldFlags.value[key]
  }

  function hasFlag(key: string): boolean {
    // Truthy check — a flag set to a positive number counts as "set", matching
    // the `{ flag: 'name' }` (truthy) contract documented in the dialog engine.
    return !!worldFlags.value[key]
  }

  function clearFlag(key: string) {
    delete worldFlags.value[key]
  }

  function learnAbility(entityId: string, abilityId: string) {
    const entity = entities.value.get(entityId)
    if (!entity) return
    const abilities = entity.abilities ?? []
    if (!abilities.includes(abilityId)) {
      entities.value.set(entityId, { ...entity, abilities: [...abilities, abilityId] })
    }
  }

  function forgetAbility(entityId: string, abilityId: string) {
    const entity = entities.value.get(entityId)
    if (!entity) return
    entities.value.set(entityId, {
      ...entity,
      abilities: (entity.abilities ?? []).filter(a => a !== abilityId),
    })
  }

  function addStatusEffect(entityId: string, effectId: StatusEffectId) {
    const entity = entities.value.get(entityId)
    if (!entity) return
    const effects = entity.statusEffects ?? []
    if (!effects.some(e => e.id === effectId)) {
      entities.value.set(entityId, { ...entity, statusEffects: [...effects, { id: effectId }] })
    }
  }

  function removeStatusEffect(entityId: string, effectId: StatusEffectId) {
    const entity = entities.value.get(entityId)
    if (!entity) return
    entities.value.set(entityId, {
      ...entity,
      statusEffects: (entity.statusEffects ?? []).filter(e => e.id !== effectId),
    })
  }

  // --- Getters ---

  const partyEntities = computed(() =>
    party.members
      .map(id => entities.value.get(id))
      .filter((e): e is EntityState => !!e),
  )

  const partyCenter = computed((): Position => {
    const positions = partyEntities.value.map(e => e.position)
    if (!positions.length) return { x: 0, y: 0, z: 0 }
    return {
      x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
      y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
      z: positions.reduce((sum, p) => sum + p.z, 0) / positions.length,
    }
  })

  const hostileEntities = computed(() =>
    [...entities.value.values()].filter(e => e.team === 'hostile' && e.hp && e.hp > 0),
  )

  const actorEntities = computed(() =>
    [...entities.value.values()].filter(e => e.type === 'character' && !party.members.includes(e.id)),
  )

  const recruitableEntities = computed(() =>
    [...entities.value.values()].filter(e => e.recruitable && !party.members.includes(e.id)),
  )

  const dismissableEntities = computed(() =>
    partyEntities.value.filter(e => e.recruitable),
  )

  const selectedEntity = computed(() =>
    selectedEntityId.value ? entities.value.get(selectedEntityId.value) : null,
  )

  const worldItems = computed(() =>
    [...entities.value.values()].filter(
      e => e.type === 'item' && (e.containerId === null || e.containerId === undefined) && !!e.model,
    ),
  )

  // --- Inventory queries ---

  function itemsIn(containerId: string, opts?: { includeEquipped?: boolean }): EntityState[] {
    const includeEquipped = opts?.includeEquipped ?? false
    return [...entities.value.values()].filter((e) => {
      if (e.type !== 'item') return false
      if (e.containerId !== containerId) return false
      if (!includeEquipped && e.slot) return false
      return true
    })
  }

  function equippedAt(characterId: string, slot: EquipmentSlotKey): EntityState | null {
    for (const e of entities.value.values()) {
      if (e.type === 'item' && e.containerId === characterId && e.slot === slot) {
        return e
      }
    }
    return null
  }

  function weightOf(characterId: string): number {
    const items = [...entities.value.values()].filter(
      e => e.type === 'item' && e.containerId === characterId,
    )
    return totalWeight(items)
  }

  function capacityOf(characterId: string): number {
    const entity = entities.value.get(characterId)
    return carryCapacity(entity?.stats?.strength)
  }

  function encumbranceOf(characterId: string): number {
    return encumbrance(weightOf(characterId), capacityOf(characterId))
  }

  function derivedEquipment(entityId: string): Equipment {
    const main = equippedAt(entityId, 'mainHand')
    const off = equippedAt(entityId, 'offHand')
    return {
      mainHand: main?.templateId,
      offHand: off?.templateId,
    }
  }

  // --- Armor (derived from equipped items) ---

  // Max armor pools = sum of `armor` from every equipped item on this character.
  function derivedMaxArmor(entityId: string): { physical: number, magical: number } {
    const equipped = [...entities.value.values()].filter(
      e => e.type === 'item' && e.containerId === entityId && e.slot,
    )
    return deriveMaxArmor(equipped)
  }

  // Refill current armor pools to their derived max (called on (re)equip — no passive regen).
  function refreshArmor(entityId: string) {
    const entity = entities.value.get(entityId)
    if (!entity || entity.type !== 'character') return
    const max = derivedMaxArmor(entityId)
    updateEntity(entityId, { physicalArmor: max.physical, magicalArmor: max.magical })
  }

  // Apply damage of a given type: deplete the matching armor pool first, overflow hits HP.
  function applyDamage(
    targetId: string,
    amount: number,
    damageTypeId: string,
  ): { armorAbsorbed: number, hpDamage: number } {
    const entity = entities.value.get(targetId)
    if (!entity) return { armorAbsorbed: 0, hpDamage: 0 }

    const armorType = useDamageTypeStore().get(damageTypeId)?.armorType
    const { armorAbsorbed, hpDamage, next } = computeDamage(entity, amount, armorType)
    updateEntity(targetId, next)
    return { armorAbsorbed, hpDamage }
  }

  // --- Inventory actions ---

  function isItemTypeForSlot(item: EntityState, slot: EquipmentSlotKey): boolean {
    switch (slot) {
      case 'mainHand':
      case 'offHand':
        return item.subtype === 'weapon'
      case 'helmet':
        return item.subtype === 'helmet'
      case 'armor':
        return item.subtype === 'armor'
      case 'cloak':
        return item.subtype === 'cloak'
      case 'trousers':
        return item.subtype === 'trousers'
      case 'gauntlets':
        return item.subtype === 'gauntlets'
      case 'boots':
        return item.subtype === 'boots'
      case 'amulet':
        return item.subtype === 'amulet'
      case 'ring1':
      case 'ring2':
        return item.subtype === 'ring'
      default:
        return false
    }
  }

  function moveItem(
    itemId: string,
    target: {
      containerId: string | null
      slot?: EquipmentSlotKey
      position?: Position
      quantity?: number
    },
  ): MoveResult {
    const item = entities.value.get(itemId)
    if (!item || item.type !== 'item') return { ok: false, reason: 'not-found' }

    const prevContainerId = item.containerId
    const wasEquipped = !!item.slot

    // Validate target
    let targetContainer: EntityState | null = null
    if (target.containerId !== null) {
      targetContainer = entities.value.get(target.containerId) ?? null
      if (!targetContainer) return { ok: false, reason: 'not-found' }
    }
    else {
      if (!target.position) return { ok: false, reason: 'invalid-target' }
    }

    // Slot validation
    if (target.slot) {
      if (!targetContainer) return { ok: false, reason: 'invalid-target' }
      if (!targetContainer.equipmentSlots?.includes(target.slot)) {
        return { ok: false, reason: 'no-slot' }
      }
      if (!isItemTypeForSlot(item, target.slot)) {
        return { ok: false, reason: 'wrong-type' }
      }
      // Swap: if the slot is occupied by a different item, unequip the occupant first
      const occupant = equippedAt(targetContainer.id, target.slot)
      if (occupant && occupant.id !== itemId) {
        updateEntity(occupant.id, { slot: undefined })
      }
    }

    const moveQty = target.quantity ?? item.quantity ?? 1
    const isPartial = moveQty < (item.quantity ?? 1)

    // Try to merge into an existing stack at the target (only for non-slot moves)
    if (target.containerId && !target.slot && item.stackable) {
      const existing = itemsIn(target.containerId).find(e =>
        e.templateId === item.templateId && (e.quantity ?? 1) < (e.maxStack ?? 1),
      )
      if (existing) {
        const room = (existing.maxStack ?? 1) - (existing.quantity ?? 1)
        const merged = Math.min(room, moveQty)
        updateEntity(existing.id, { quantity: (existing.quantity ?? 1) + merged })
        if (merged === (item.quantity ?? 1)) {
          // Whole stack absorbed; remove the moved entity
          removeEntity(item.id)
        }
        else {
          // Target stack filled to maxStack; leftover units stay on the source container
          updateEntity(item.id, { quantity: (item.quantity ?? 1) - merged })
        }
        syncEncumbrance(prevContainerId)
        syncEncumbrance(target.containerId)
        return { ok: true }
      }
    }

    // Partial move: split into a new entity
    if (isPartial) {
      const newId = `${item.templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const split: EntityState = {
        ...item,
        id: newId,
        quantity: moveQty,
        containerId: target.containerId,
        slot: target.slot,
        position: target.containerId === null ? target.position! : item.position,
      }
      spawnEntity(newId, split)
      updateEntity(item.id, { quantity: (item.quantity ?? 1) - moveQty })
      syncEncumbrance(prevContainerId)
      syncEncumbrance(target.containerId)
      return { ok: true }
    }

    // Whole-entity reparent
    updateEntity(item.id, {
      containerId: target.containerId,
      slot: target.slot,
      position: target.containerId === null ? target.position! : item.position,
    })

    syncEncumbrance(prevContainerId)
    syncEncumbrance(target.containerId)

    // An equip or unequip changed armor totals → refill affected characters' pools.
    if (target.slot || wasEquipped) {
      if (target.containerId) refreshArmor(target.containerId)
      if (prevContainerId && prevContainerId !== target.containerId) refreshArmor(prevContainerId)
    }
    return { ok: true }
  }

  function syncEncumbrance(characterId: string | null | undefined) {
    if (!characterId) return
    const character = entities.value.get(characterId)
    if (!character || character.type !== 'character') return
    const ratio = encumbranceOf(characterId)
    const hasEffect = character.statusEffects?.some(e => e.id === 'encumbered') ?? false
    if (ratio >= 1 && !hasEffect) {
      addStatusEffect(characterId, 'encumbered')
    }
    else if (ratio < 1 && hasEffect) {
      removeStatusEffect(characterId, 'encumbered')
    }
  }

  function equipItem(itemId: string, slot: EquipmentSlotKey): MoveResult {
    const item = entities.value.get(itemId)
    if (!item) return { ok: false, reason: 'not-found' }
    const ownerId = item.containerId
    if (!ownerId) return { ok: false, reason: 'invalid-target' }
    return moveItem(itemId, { containerId: ownerId, slot })
  }

  function unequipItem(itemId: string): MoveResult {
    const item = entities.value.get(itemId)
    if (!item) return { ok: false, reason: 'not-found' }
    if (!item.slot || !item.containerId) return { ok: false, reason: 'invalid-target' }
    return moveItem(itemId, { containerId: item.containerId, slot: undefined })
  }

  function dropItem(itemId: string, position: Position): MoveResult {
    return moveItem(itemId, { containerId: null, position })
  }

  function pickupItem(itemId: string, characterId: string): MoveResult {
    return moveItem(itemId, { containerId: characterId })
  }

  function transferItem(itemId: string, toCharacterId: string): MoveResult {
    return moveItem(itemId, { containerId: toCharacterId })
  }

  return {
    // State
    currentScene,
    worldFlags,
    entities,
    party,
    selectedEntityId,
    inputBlocked,
    // Entity actions
    spawnEntity,
    updateEntity,
    removeEntity,
    getEntity,
    spawnFromTemplate,
    spawnItemEntity,

    // Scene actions
    loadScene,

    // Party actions
    addToParty,
    removeFromParty,
    recruitEntity,
    dismissEntity,
    setPartyLeader,

    // Selection actions
    selectEntity,

    // Flag actions
    setFlag,
    getFlag,
    hasFlag,
    clearFlag,

    // Ability actions
    learnAbility,
    forgetAbility,

    // Status effect actions
    addStatusEffect,
    removeStatusEffect,

    // Combat / armor
    applyDamage,
    derivedMaxArmor,
    refreshArmor,

    // Getters
    partyEntities,
    partyCenter,
    hostileEntities,
    actorEntities,
    recruitableEntities,
    dismissableEntities,
    selectedEntity,
    worldItems,

    // Inventory queries
    itemsIn,
    equippedAt,
    weightOf,
    capacityOf,
    encumbranceOf,
    derivedEquipment,

    // Inventory actions
    isItemTypeForSlot,
    moveItem,
    equipItem,
    unequipItem,
    dropItem,
    pickupItem,
    transferItem,
    syncEncumbrance,

    // Content source
    configureContent,
    resolveTemplate,
    resolveAbility,
    resolveDialog,
    resolveClass,
  }
})
