<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true, animations: true, statusEffects: true })

onMounted(async () => {
  const fenrathId = await gameStore.spawnFromTemplate('fenrath', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(fenrathId)
  gameStore.selectEntity(fenrathId)
})

const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})
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
  <TresAxesHelper />
  <Floor />
</template>
