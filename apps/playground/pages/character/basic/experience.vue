<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { useSceneRefs } from '@artificer-forge/composables'

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
