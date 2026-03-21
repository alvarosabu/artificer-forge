<script setup lang="ts">
import { Floor } from '@artificer-forge/components'
import type { TresPointerEvent } from '@tresjs/core'
import { Vector3 } from 'three'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const { close: closePalette } = useCommandPalette()

const {
  setCharacterRef,
  setInteractableRef,
  getCharacterRef,
  getInteractableRef,
} = useSceneRefs()

const { registerHandler, unregisterHandler, SLOT_ANIMATION_MAP } = useActionBar()

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
  }
})

const selectedCharacterRef = computed(() => {
  if (!gameStore.selectedEntityId) return null
  return getCharacterRef(gameStore.selectedEntityId)
})

const targetIndicatorPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.selectedEntity?.moveTarget
  if (!target) return null
  return [target.x, 0.01, target.z]
})

const { register: registerAnimations, unregister: unregisterAnimations } = useAnimationCommands(
  selectedCharacterRef,
  closePalette,
)

const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands()

function registerActionBarHandlers() {
  for (const [slotId, animName] of Object.entries(SLOT_ANIMATION_MAP)) {
    registerHandler(slotId, () => {
      selectedCharacterRef.value?.play(animName)
    })
  }
}

function unregisterActionBarHandlers() {
  for (const slotId of Object.keys(SLOT_ANIMATION_MAP)) {
    unregisterHandler(slotId)
  }
}

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)
  gameStore.equipWeapon(playerId, 'shortsword', 'mainHand')

  const { spawnPoint } = await gameStore.loadScene('interactable_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })

  registerAnimations()
  registerEntities()
  registerActionBarHandlers()
})

onUnmounted(() => {
  unregisterAnimations()
  unregisterEntities()
  unregisterActionBarHandlers()
})

const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character' && e.subtype !== 'npc')
})

const interactableEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'interactable')
})

function handleFloorClick(event: TresPointerEvent) {
  closeActiveInteractable()
  selectedCharacterRef.value?.moveTo(event.point)
}

const INTERACTION_DISTANCE = 1.5
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

  const direction = playerPos.clone().sub(interactablePos).normalize()
  const targetPos = interactablePos.clone().add(direction.multiplyScalar(INTERACTION_DISTANCE))
  targetPos.y = 0

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
