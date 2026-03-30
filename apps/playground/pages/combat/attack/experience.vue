<script setup lang="ts">
import { Floor } from '@artificer-forge/components/tres'
import { TargetReticle } from '@artificer-forge/vfx'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()

useCommands({ entities: true })

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: -1.5, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  await gameStore.spawnFromTemplate('orc_scout', { x: 1.5, y: 0, z: 0 })
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresPerspectiveCamera :position="[0, 5, 8]" :look-at="[0, 1, 0]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <TargetReticle                                                  
    :position="[0, 0.01, 0]"                                   
    :color="'#ff0000'"                                      
    :radius="0.8"                                                 
    :visible="true"                                    
  /> 
  <Floor />
</template>
