<script setup lang="ts">
import { Character, Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
import { WorldItem as InventoryWorldItem } from '@artificer-forge/engine/ui'
const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true, animations: true, statusEffects: true, recruit: true })

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('character_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })
})

const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})

const { worldItems } = storeToRefs(gameStore)

</script>

<template>
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
