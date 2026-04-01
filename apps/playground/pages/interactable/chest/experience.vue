<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { Vector3 } from 'three'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const {
  setCharacterRef,
  setInteractableRef,
  getCharacterRef,
  getInteractableRef,
} = useSceneRefs()

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

const selectedCharacterRef = computed(() =>
  gameStore.selectedEntityId ? getCharacterRef(gameStore.selectedEntityId) : null,
)

useCommands({ entities: true, animations: true })

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)
  gameStore.equipWeapon(playerId, 'shortsword', 'mainHand')

  const { spawnPoint } = await gameStore.loadScene('interactable_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })
})

const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character' && e.subtype !== 'npc')
})

const interactableEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'interactable')
})


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
  <Floor />
</template>
