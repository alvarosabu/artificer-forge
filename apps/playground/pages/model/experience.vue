<script setup lang="ts">
import { Floor } from '@artificer-forge/components'

const gameStore = useGameStore()

// Spawn the ranger on mount
const rangerEntityId = ref<string | null>(null)

onMounted(async () => {
  // Spawn ranger at origin and add to party
  const entityId = await gameStore.spawnFromTemplate('ranger', { x: 0, y: 0, z: 0 })
  rangerEntityId.value = entityId
  gameStore.addToParty(entityId)
})

// Get character entities to render
const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})
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
  <Suspense>
    <Character
      v-for="entity in characterEntities"
      :key="entity.id"
      :position="[entity.position.x, entity.position.y, entity.position.z]"
      :model="entity.model"
    />
  </Suspense>
  <TresAxesHelper />
  <Floor />
</template>
