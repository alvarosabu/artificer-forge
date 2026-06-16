<script setup lang="ts">
import { Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

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

useCommands({ entities: true, animations: true, statusEffects: true, recruit: true })

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
})

const characterEntities = computed(() => gameStore.partyEntities)

const actorEntities = computed(() => gameStore.actorEntities)

</script>

<template>
  <TresFog :args="['#020420', 10, 30]" />
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
  <Floor />
</template>
