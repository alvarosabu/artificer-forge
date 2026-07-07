<script setup lang="ts">
// Modular playable character: tav (template-driven appearance) in the party +
// a second modular NPC through Actor.vue. Exercises both engine rig paths.
import { Actor, Character, Floor, useGameStore, useSceneRefs } from '@artificer-forge/engine/runtime'

const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true, animations: true, statusEffects: true, recruit: true })

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('character_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })

  // Modular NPC via Actor.vue: same template, different look + neutral team.
  await gameStore.spawnFromTemplate('tav', { x: spawnPoint.x + 3, y: spawnPoint.y, z: spawnPoint.z - 2 }, {
    name: 'Villager',
    team: 'neutral',
    controllable: false,
    ai: { behavior: 'idle' },
    appearance: {
      body: 'HUM_F_MEDIUM_Body_A',
      head: 'HUM_F_Head_A',
      hair: 'GEN_F_Hair_Long_B',
      beard: null,
      eyebrows: 'GEN_Eyebrows_Thin_B',
      horns: null,
      skinColor: '#8d5524',
      hairColor: '#2c222b',
    },
    sex: 'F',
  })
})

const characterEntities = computed(() => gameStore.partyEntities)
const actorEntities = computed(() => gameStore.actorEntities)
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
  <Actor
    v-for="entity in actorEntities"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <TresAxesHelper />
  <Floor />
</template>
