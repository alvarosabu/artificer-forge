<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { Vector3 } from 'three'
import { useSceneRefs } from '@artificer-forge/composables'

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
})

const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character' && e.subtype !== 'npc')
})

const worldItems = computed(() =>
  [...gameStore.entities.values()].filter(
    e => e.type === 'item' && (e.containerId === null || e.containerId === undefined) && !!e.model,
  ),
)

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
  <Suspense
    v-for="worldItem in worldItems"
    :key="worldItem.id"
  >
    <InventoryWorldItem :item="worldItem" />
  </Suspense>
  <TresAxesHelper />
  <Floor />
</template>
