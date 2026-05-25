<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true, animations: true, statusEffects: true, damageNumbers: true })

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: -10, y: 0, z: 10 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)
  await gameStore.spawnItemEntity('bow', { containerId: heroId, slot: 'offHand' })

  await gameStore.spawnFromTemplate('orc_scout', { x: 4, y: 0, z: -2 })
  await gameStore.spawnFromTemplate('orc_scout', { x: 6, y: 0, z: 1 })
  await gameStore.spawnFromTemplate('orc_scout', { x: 8, y: 0, z: -1 })
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresPerspectiveCamera :position="[15, 15, 15]" :look-at="[4, 0, 0]" />
  <OrbitControls />
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
