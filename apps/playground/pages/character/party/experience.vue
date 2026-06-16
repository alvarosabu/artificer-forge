<script setup lang="ts">
import { Character, Floor, useGameStore, useSceneRefs } from '@artificer-forge/engine/runtime'
const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true, animations: true, statusEffects: true, recruit: true })

// Party members get recruited; NPCs (orc, guard) are spawned but stay out of the
// party. Spread along X so the whole roster lines up facing the camera — handy for
// eyeballing the auto-generated portraits (ActionBar) against the live models.
const PARTY = [
  { template: 'fenrath', position: { x: -4, y: 0, z: 0 } },
  { template: 'hero', position: { x: -2, y: 0, z: 0 } },
  { template: 'zynrae', position: { x: 0, y: 0, z: 0 } },
]
const NPCS = [
  { template: 'orc_scout', position: { x: 2, y: 0, z: 0 } },
  { template: 'guard_captain', position: { x: 4, y: 0, z: 0 } },
]

onMounted(async () => {
  for (const { template, position } of PARTY) {
    const id = await gameStore.spawnFromTemplate(template, position)
    gameStore.addToParty(id)
    if (template === 'hero') gameStore.selectEntity(id)
  }
  for (const { template, position } of NPCS) {
    await gameStore.spawnFromTemplate(template, position)
  }
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight
    :position="[5, 8, 5]"
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
