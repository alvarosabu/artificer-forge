// Types
export interface Position {
  x: number
  y: number
  z: number
}

export interface EntityState {
  id: string
  templateId: string
  type: 'character' | 'item' | 'interactable'
  name: string
  position: Position
  rotation?: Position

  // Rendering
  model?: string
  animations?: Record<string, string>

  // Character-specific
  faction?: string
  hostile?: boolean
  controllable?: boolean
  hp?: number
  maxHp?: number
  stats?: Record<string, number>
  ai?: {
    behavior: string
    [key: string]: unknown
  }

  // Item-specific
  owner?: string
  quantity?: number

  // Interactable-specific
  locked?: boolean
  opened?: boolean
}

export interface Item {
  id: string
  templateId: string
  quantity: number
}

export const useGameStore = defineStore('game', () => {
  // === WORLD STATE ===
  const currentScene = ref<string>('main')
  const worldFlags = ref<Record<string, boolean | number>>({})

  // === ENTITIES ===
  const entities = ref<Map<string, EntityState>>(new Map())

  // === PARTY ===
  const party = reactive({
    members: [] as string[],
    leader: null as string | null,
    inventory: [] as Item[],
  })

  // === ANIMATIONS (for character controller) ===
  const animations = ref<string[]>([])
  const currentAnimation = ref<string | null>(null)

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
      name: template.name,
      position,
      model: template.model,
      animations: template.animations,
      faction: template.faction,
      hostile: template.hostile,
      controllable: template.controllable,
      hp: template.stats?.hp,
      maxHp: template.stats?.maxHp,
      stats: template.stats,
      ai: template.ai,
      ...overrides,
    }

    spawnEntity(instanceId, entityState)
    return instanceId
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

  function setPartyLeader(entityId: string) {
    if (party.members.includes(entityId)) {
      party.leader = entityId
    }
  }

  function addToInventory(item: Item) {
    const existing = party.inventory.find(i => i.templateId === item.templateId)
    if (existing) {
      existing.quantity += item.quantity
    }
    else {
      party.inventory.push(item)
    }
  }

  function removeFromInventory(templateId: string, quantity = 1) {
    const idx = party.inventory.findIndex(i => i.templateId === templateId)
    if (idx > -1) {
      const item = party.inventory[idx]
      if (item) {
        item.quantity -= quantity
        if (item.quantity <= 0) {
          party.inventory.splice(idx, 1)
        }
      }
    }
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

  // --- Animation Actions ---

  function addAnimation(animation: string) {
    if (!animations.value.includes(animation)) {
      animations.value.push(animation)
    }
  }

  function setCurrentAnimation(animation: string | null) {
    currentAnimation.value = animation
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
    [...entities.value.values()].filter(e => e.hostile && e.hp && e.hp > 0),
  )

  return {
    // State
    currentScene,
    worldFlags,
    entities,
    party,
    animations,
    currentAnimation,

    // Entity actions
    spawnEntity,
    updateEntity,
    removeEntity,
    getEntity,
    spawnFromTemplate,

    // Party actions
    addToParty,
    removeFromParty,
    setPartyLeader,
    addToInventory,
    removeFromInventory,

    // Flag actions
    setFlag,
    getFlag,
    hasFlag,

    // Animation actions
    addAnimation,
    setCurrentAnimation,

    // Getters
    partyEntities,
    partyCenter,
    hostileEntities,
  }
})
