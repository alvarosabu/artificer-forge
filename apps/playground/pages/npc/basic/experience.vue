<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import type { TresPointerEvent } from '@tresjs/core'
import { useSceneRefs } from '@artificer-forge/composables'
import { TargetIndicator } from '@artificer-forge/vfx'

const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()

const { onAction } = useContextMenu()

onAction((action, entityId) => {
  const entity = gameStore.getEntity(entityId)
  if (!entity) return

  switch (action) {
    case 'examine':
      console.log('Examine:', entityId)
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
  }
})

const selectedCharacterRef = computed(() =>
  gameStore.selectedEntityId ? getCharacterRef(gameStore.selectedEntityId) : null,
)

const targetIndicatorPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.selectedEntity?.moveTarget
  if (!target) return null
  return [target.x, 0.01, target.z]
})

useCommands({ entities: true, animations: true, statusEffects: true, recruit: true, actionBar: true })

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('npc_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })

  // Spawn Zynrae offset from hero spawn point
  const companionId = await gameStore.spawnFromTemplate('zynrae', {
    x: spawnPoint.x + 5,
    y: spawnPoint.y,
    z: spawnPoint.z,
  })
  gameStore.addStatusEffect(companionId, 'poisoned')
  gameStore.equipWeapon(companionId, 'dagger', 'mainHand')
})

const characterEntities = computed(() => gameStore.partyEntities)

const actorEntities = computed(() => gameStore.actorEntities)

function handleFloorClick(event: TresPointerEvent) {
  selectedCharacterRef.value?.moveTo(event.point)
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
  <Actor
    v-for="entity in actorEntities"
    :key="entity.id"
    :entity-id="entity.id"
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
