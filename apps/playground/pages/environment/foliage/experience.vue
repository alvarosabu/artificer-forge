<script setup lang="ts">
import { computed } from 'vue'
import { Object3D, Vector3 } from 'three'
import { Character, Floor, Foliage, Grass, useEnvironmentStore, useGameStore, useSceneRefs } from '@artificer-forge/engine/runtime'
const references = [
  { position: [2, 0, -3] as [number, number, number], scale: 1.0 },
  { position: [-4, 0, 1] as [number, number, number], scale: 0.8 },
  { position: [5, 0, 4] as [number, number, number], scale: 1.2 },
  { position: [-2, 0, -5] as [number, number, number], scale: 0.9 },
  { position: [0, 0, 6] as [number, number, number], scale: 1.1 },
].map(({ position, scale }) => {
  const obj = new Object3D()
  obj.position.set(...position)
  obj.scale.setScalar(scale)
  obj.updateMatrixWorld()
  return obj
})


const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()


const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})

const { state: foliageTexture } = useTexture('/textures/foliage/foliage.png')

watch(foliageTexture, (tex) => {
  console.log('[Experience] watch fired, tex:', tex)
}, { immediate: true, deep: true })

const { uuid } = useSharedLechesControls()

const { foliageColorA, foliageColorB } = useControls('foliage', {
  colorA: { value: '#b4b536', type: 'color' },
  colorB: { value: '#d8cf3b', type: 'color' },
}, { uuid })

const { grassColorA, grassColorB } = useControls('grass', {
  colorA: { value: '#b4b536', type: 'color' },
  colorB: { value: '#d8cf3b', type: 'color' },
}, { uuid })


const environment = useEnvironmentStore()

const { windAngle, windStrength, windVariability } = useControls('wind', {
  angle: { value: environment.baseWindAngle, min: -Math.PI, max: Math.PI, step: 0.01, type: 'range' },
  strength: { value: environment.baseWindStrength, min: 0, max: 1, step: 0.01, type: 'range' },
  variability: { value: environment.windVariability, min: 0, max: 2, step: 0.01, type: 'range' },
}, { uuid })

watch(windAngle, (v) => environment.setWind({ angle: v }))
watch(windStrength, (v) => environment.setWind({ strength: v }))
watch(windVariability, (v) => environment.setWind({ variability: v }))

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => environment.tickWind(delta))

const { lightX, lightY, lightZ } = useControls('light', {
  x: { value: 5, type: 'number' },
  y: { value: 5, type: 'number' },
  z: { value: 5, type: 'number' },
}, { uuid })

const lightingDirection = computed(() =>
  new Vector3(-lightX.value, -lightY.value, -lightZ.value).normalize()
)

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('character_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })
})

</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[lightX, lightY, lightZ]" :intensity="1.5" cast-shadow />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <!-- <TresMesh :rotation-x="-Math.PI / 2" :position="[0, 0.01, 0]" receive-shadow>
    <TresPlaneGeometry :args="[20, 20]" />
    <TresMeshStandardMaterial />
  </TresMesh> -->
  <Floor />
  <Foliage
    :references="references"
    :foliage-texture="foliageTexture"
    :color-a="foliageColorA"
    :color-b="foliageColorB"
    :lighting-direction="lightingDirection"
    :amount="80"
    :size="0.8"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Grass
    :subdivisions="200"
    :size="30"
    :color-a="grassColorA"
    :color-b="grassColorB"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
</template>
