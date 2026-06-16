<script setup lang="ts">
import { Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands()

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: -1.5, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  await gameStore.spawnFromTemplate('orc_scout', { x: 1.5, y: 0, z: 0 })

  registerEntities()
})

onUnmounted(() => {
  unregisterEntities()
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"

  />
  <Floor />
</template>
