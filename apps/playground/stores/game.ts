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
export type EquipmentSlotKey = 'mainHand' | 'offHand'

export type StatusEffectId = 'poisoned' | 'stunned' | 'burning' | 'blessed' | 'hasted' | 'frozen'

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
  model?: string
  rig?: string
  animations?: Record<string, unknown>
  
  // Character-specific
  class?: string
  level?: number
  race?: string
  faction?: string
  team?: Team
  controllable?: boolean
  recruitable?: boolean
  hp?: number
  maxHp?: number
  stats?: Record<string, number>
  ai?: {
    behavior: string
    [key: string]: unknown
  }

  // Interactable-specific
  locked?: boolean
  opened?: boolean
  destructible?: boolean

  // Equipment-specific
  equipment?: Equipment

  // Status effects
  statusEffects?: StatusEffect[]

  // Abilities
  abilities?: string[]

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
  damage?: { dice: string, type: string }
  properties?: string[]
  range?: { normal: number, long: number }
  effect?: { type: string, dice?: string, bonus?: number }
  value?: number
  usable?: boolean
}

const DEFAULT_ABILITIES = ['melee-attack', 'dash', 'throw']

export const useGameStore = defineStore('game', () => {
  // === LECHESS ===
  const { addFolder } = useSharedLechesControls()

  const { debugBvh } = addFolder('debug', {
    bvh: false,
  })

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

  // Spawn from a content template by templateId
  async function spawnFromTemplate(
    templateId: string,
    position: Position,
    overrides?: Partial<EntityState>,
  ): Promise<string> {
    const template = await queryCollection('entities').where('templateId', '=', templateId).first()
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
      model: template.model,
      rig: template.rig,
      animations: template.animations,
      class: template.class,
      level: template.level,
      race: template.race,
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
      equipment: template.equipment,
      abilities: [...DEFAULT_ABILITIES, ...((template as any).abilities ?? [])],
      statusEffects: [],
      ...overrides,
    }

    spawnEntity(instanceId, entityState)
    return instanceId
  }

  // --- Scene Actions ---

  async function loadScene(sceneId: string, spawnPointId: string = 'default') {
    const scene = await queryCollection('scenes')
      .where('sceneId', '=', sceneId)
      .first()

    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`)
    }

    // Clear only NON-party entities
    for (const [id] of entities.value) {
      if (!party.members.includes(id)) {
        entities.value.delete(id)
      }
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
  }

  // --- Flag Actions ---

  function setFlag(key: string, value: boolean | number) {
    worldFlags.value[key] = value
  }

  function getFlag(key: string): boolean | number | undefined {
    return worldFlags.value[key]
  }

  function hasFlag(key: string): boolean {
    return worldFlags.value[key] === true
  }

  // --- Equipment Actions ---

  function equipWeapon(entityId: string, weaponTemplateId: string, slot: 'mainHand' | 'offHand') {
    const entity = entities.value.get(entityId)
    if (entity) {
      entity.equipment = { ...entity.equipment, [slot]: weaponTemplateId }
    }
  }

  function unequipWeapon(entityId: string, slot: 'mainHand' | 'offHand') {
    const entity = entities.value.get(entityId)
    if (entity) {
      entity.equipment = { ...entity.equipment, [slot]: undefined }
    }
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

  return {
    // State
    currentScene,
    worldFlags,
    entities,
    party,
    selectedEntityId,
    // Entity actions
    spawnEntity,
    updateEntity,
    removeEntity,
    getEntity,
    spawnFromTemplate,

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

    // Equipment actions
    equipWeapon,
    unequipWeapon,

    // Ability actions
    learnAbility,
    forgetAbility,

    // Status effect actions
    addStatusEffect,
    removeStatusEffect,

    // Getters
    partyEntities,
    partyCenter,
    hostileEntities,
    actorEntities,
    recruitableEntities,
    dismissableEntities,
    selectedEntity,

    // Debug actions
    debugBvh,
  }
})
