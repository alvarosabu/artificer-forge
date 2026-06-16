<script setup lang="ts">
import { Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
import { Vector3 } from 'three'
const gameStore = useGameStore()
const {
  setCharacterRef,
  getCharacterRef,
} = useSceneRefs()

const { onAction, state: ctxState } = useContextMenu()
const loot = useLoot()

onAction((action, entityId) => {
  const entity = gameStore.getEntity(entityId)
  if (!entity) return

  switch (action) {
    case 'examine':
      console.log('Examine:', entityId)
      break
    case 'loot':
      walkToAndLoot(entityId)
      break
    case 'pickup': {
      const recipient = gameStore.selectedEntityId ?? gameStore.party.leader
      if (recipient) gameStore.pickupItem(entityId, recipient)
      break
    }
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

  const { spawnPoint } = await gameStore.loadScene('corpse_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })

  const zynraeId = await gameStore.spawnFromTemplate('zynrae', {
    x: spawnPoint.x + 2,
    y: spawnPoint.y,
    z: spawnPoint.z,
  })
  if (zynraeId) gameStore.addToParty(zynraeId)

  await gameStore.spawnFromTemplate('orc_scout', {
    x: spawnPoint.x + 4,
    y: spawnPoint.y,
    z: spawnPoint.z + 4,
  }, { dead: true, hp: 0 })

})

const characterEntities = computed(() => gameStore.partyEntities)

const actorEntities = computed(() => gameStore.actorEntities)

const { worldItems } = storeToRefs(gameStore)

const INTERACTION_DISTANCE = 1.5

function walkToAndLoot(entityId: string) {
  const target = gameStore.getEntity(entityId)
  const player = gameStore.selectedEntity
  if (!target || !player || !selectedCharacterRef.value) return

  const targetPos = new Vector3(target.position.x, target.position.y, target.position.z)
  const playerPos = new Vector3(player.position.x, player.position.y, player.position.z)
  const direction = playerPos.clone().sub(targetPos).normalize()
  const approach = targetPos.clone().add(direction.multiplyScalar(INTERACTION_DISTANCE))
  approach.y = 0

  const { off } = selectedCharacterRef.value.onArrive(() => {
    loot.open(entityId, ctxState.x || window.innerWidth - 320, ctxState.y || 120)
    off()
  })

  selectedCharacterRef.value.moveTo(approach)
}
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
  <Character
    v-for="entity in actorEntities"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Suspense
    v-for="worldItem in worldItems"
    :key="worldItem.id"
  >
    <InventoryWorldItem :item="worldItem" />
  </Suspense>
  <TresAxesHelper />
  <Floor />
</template>
