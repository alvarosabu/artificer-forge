<script setup lang="ts">
import { Floor } from '@artificer-forge/components'
import type { TresPointerEvent } from '@tresjs/core'
import type { Vector3 } from 'three'

const gameStore = useGameStore()
const { close: closePalette } = useCommandPalette()

// Registry of character refs by entity ID
const characterRefs = ref<Map<string, { play: (name: string) => void }>>(new Map())

// Get the selected character's ref
const selectedCharacterRef = computed(() => {
  if (!gameStore.selectedEntityId) return null
  return characterRefs.value.get(gameStore.selectedEntityId) ?? null
})

// Register/unregister character refs
function setCharacterRef(entityId: string, ref: { play: (name: string) => void } | null) {
  if (ref) {
    characterRefs.value.set(entityId, ref)
  }
  else {
    characterRefs.value.delete(entityId)
  }
}

// Register animation commands
const { register: registerAnimations, unregister: unregisterAnimations } = useAnimationCommands(
  selectedCharacterRef,
  closePalette,
)

// Register entity commands
const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands(
  closePalette,
)

onMounted(async () => {
  // Spawn ranger at origin and add to party
  const entityId = await gameStore.spawnFromTemplate('ranger', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(entityId)

  // Auto-select first spawned character
  gameStore.selectEntity(entityId)

  // Register commands after mount
  registerAnimations()
  registerEntities()
})

onUnmounted(() => {
  unregisterAnimations()
  unregisterEntities()
})

// Get character entities to render
const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})

function handleFloorClick(event: TresPointerEvent) {
  console.log('Floor clicked at', event.point)
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
  <Suspense>
    <Character
      v-for="entity in characterEntities"
      :ref="(el: any) => setCharacterRef(entity.id, el)"
      :key="entity.id"
      :entity-id="entity.id"
    />
  </Suspense>
  <TresAxesHelper />
  <Floor @click="handleFloorClick" />
</template>
