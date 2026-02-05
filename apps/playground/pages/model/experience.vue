<script setup lang="ts">
import { Floor } from '@artificer-forge/components'
import type { TresPointerEvent } from '@tresjs/core'
import { BoxGeometry, Mesh, MeshNormalMaterial, Vector3 } from 'three'

const gameStore = useGameStore()
const { close: closePalette } = useCommandPalette()

const {
  setCharacterRef,
  setInteractableRef,
  getCharacterRef,
  getInteractableRef,
} = useSceneRefs()

// Context menu action handler
const { onAction } = useContextMenu()

onAction((action, entityId) => {
  const entity = gameStore.getEntity(entityId)
  if (!entity) return

  switch (action) {
    case 'examine':
      console.log('Examine:', entityId)
      break
    case 'use':
    case 'close':
      handleInteractableClick(entityId)
      break
    case 'lockpick':
      console.log('Lockpick:', entityId)
      break
    case 'attack':
      console.log('Attack:', entityId)
      break
    case 'talk':
      console.log('Talk:', entityId)
      break
    case 'follow':
      console.log('Follow:', entityId)
      break
    case 'pickup':
      console.log('Pickup:', entityId)
      break
  }
})

// Get the selected character's ref
const selectedCharacterRef = computed(() => {
  if (!gameStore.selectedEntityId) return null
  return getCharacterRef(gameStore.selectedEntityId)
})

// Target indicator position from selected entity's moveTarget
const targetIndicatorPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.selectedEntity?.moveTarget
  if (!target) return null
  return [target.x, 0.01, target.z]
})

// Register animation commands
const { register: registerAnimations, unregister: unregisterAnimations } = useAnimationCommands(
  selectedCharacterRef,
  closePalette,
)

// Register entity commands
const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands(
  closePalette,
)

onMounted(async () => {
  // Spawn ranger and add to party
  const entityId = await gameStore.spawnFromTemplate('ranger', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(entityId)
  gameStore.selectEntity(entityId)

  // Load scene and position party at spawn point
  const { spawnPoint } = await gameStore.loadScene('test_scene')
  gameStore.updateEntity(entityId, { position: spawnPoint })

  // Register commands after mount
  registerAnimations()
  registerEntities()
})

onUnmounted(() => {
  unregisterAnimations()
  unregisterEntities()
})

// Get character entities to render
const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})

// Get interactable entities to render
const interactableEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'interactable')
})

function handleFloorClick(event: TresPointerEvent) {
  closeActiveInteractable()
  selectedCharacterRef.value?.moveTo(event.point)
}

// Distance from interactable where player should stop
const INTERACTION_DISTANCE = 1.5

// Track currently open interactable
const activeInteractableId = ref<string | null>(null)

function closeActiveInteractable() {
  if (!activeInteractableId.value) return
  const ref = getInteractableRef(activeInteractableId.value)
  const entity = gameStore.getEntity(activeInteractableId.value)
  if (ref && entity?.opened) {
    ref.toggle()
  }
  activeInteractableId.value = null
}

function handleInteractableClick(entityId: string) {
  const interactable = gameStore.getEntity(entityId)
  const player = gameStore.selectedEntity
  if (!interactable || !player || !selectedCharacterRef.value) return

  // Close previous interactable if different
  if (activeInteractableId.value && activeInteractableId.value !== entityId) {
    closeActiveInteractable()
  }

  const interactablePos = new Vector3(
    interactable.position.x,
    interactable.position.y,
    interactable.position.z,
  )
  const playerPos = new Vector3(
    player.position.x,
    player.position.y,
    player.position.z,
  )

  // Calculate direction from interactable to player
  const direction = playerPos.clone().sub(interactablePos).normalize()

  // Target position: offset from interactable towards player
  const targetPos = interactablePos.clone().add(direction.multiplyScalar(INTERACTION_DISTANCE))
  targetPos.y = 0 // Keep on ground

  // Register one-time listener for arrival
  const interactableRef = getInteractableRef(entityId)
  const { off } = selectedCharacterRef.value.onArrive(() => {
    interactableRef?.toggle()
    activeInteractableId.value = entityId
    off()
  })

  selectedCharacterRef.value.moveTo(targetPos)
}

</script>

<template>
  <TresFog :args="['#020420', 10, 30]" />
  <TresPerspectiveCamera :position="[5, 5, 5]" :near="0.1" :far="100" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight
    :position="[5, 5, 5]"
    :intensity="1.5"
    cast-shadow
  />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Interactable
    v-for="entity in interactableEntities"
    :ref="(el: any) => setInteractableRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
    @interact="handleInteractableClick"
  />
  <TresAxesHelper />
  <Floor @click="handleFloorClick" />
  <TargetIndicator
    v-if="targetIndicatorPosition"
    :position="targetIndicatorPosition"
    :radius="0.4"
    :height="0.8"
    :pulse-speed="3"
  />
</template>
