<script setup lang="ts">
import { computed } from 'vue'
import { until } from '@vueuse/core'
import { EquirectangularReflectionMapping, Object3D, SRGBColorSpace, Vector3 } from 'three'
import type { AnimationAction } from 'three'
import { AnimationName, Character, createTrampleMap, Floor, Flowers, Foliage, Grass, GrassTufts, useEnvironmentStore, useGameStore, useSceneRefs, WindLines } from '@artificer-forge/engine/runtime'



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
const { setCharacterRef, getCharacterRef } = useSceneRefs()


const characterEntities = computed(() => {
  return [...gameStore.entities.values()].filter(e => e.type === 'character')
})

const { state: foliageTexture } = useTexture('/textures/foliage/foliage.png')

const { uuid } = useSharedLechesControls()

const { subdivisions, fieldSize } = useControls('field', {
  subdivisions: { value: 400, min: 100, max: 1000, step: 100, type: 'range' },
  size: { value: 100, min: 10, max: 400, step: 10, type: 'range' },
}, { uuid })

const { foliageColorA, foliageColorB } = useControls('foliage', {
  colorA: { value: '#b4b536', type: 'color' },
  colorB: { value: '#d8cf3b', type: 'color' },
}, { uuid })

const { grassColorA, grassColorB } = useControls('grass', {
  colorA: { value: '#b4b536', type: 'color' },
  colorB: { value: '#d8cf3b', type: 'color' },
}, { uuid })

const { tuftsDensity, tuftsHeight, tuftsSpread, tuftsColorA, tuftsColorB } = useControls('tufts', {
  density: { value: 0.35, min: 0, max: 1, step: 0.01, type: 'range' },
  height: { value: 2.2, min: 0.4, max: 4, step: 0.05, type: 'range' },
  spread: { value: 0.45, min: 0.1, max: 1.2, step: 0.01, type: 'range' },
  colorA: { value: '#2f5d2a', type: 'color' },
  colorB: { value: '#7fae3c', type: 'color' },
}, { uuid })

// one folder per flower species — leches folder names must stay single-word
const { puffsDensity, puffsHeight, puffsColor } = useControls('puffs', {
  density: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  height: { value: 0.85, min: 0.1, max: 1.5, step: 0.01, type: 'range' },
  color: { value: '#ffffff', type: 'color' },
}, { uuid })

const { poppiesDensity, poppiesHeight, poppiesColor } = useControls('poppies', {
  density: { value: 0.34, min: 0, max: 1, step: 0.01, type: 'range' },
  height: { value: 0.44, min: 0.1, max: 1.5, step: 0.01, type: 'range' },
  color: { value: '#c4202a', type: 'color' },
}, { uuid })

const { daisiesDensity, daisiesHeight, daisiesColor } = useControls('daisies', {
  density: { value: 0.38, min: 0, max: 1, step: 0.01, type: 'range' },
  height: { value: 0.32, min: 0.1, max: 1.5, step: 0.01, type: 'range' },
  color: { value: '#e8c22a', type: 'color' },
}, { uuid })

const { state: grassDiffuseMap } = useTexture('/textures/grass/splat.jpg')
watch(grassDiffuseMap, (tex) => {
  if (tex) tex.colorSpace = SRGBColorSpace
}, { immediate: true })


const { scene } = useTresContext()

const { skySkybox } = useControls('sky', {
  skybox: { value: 'day', options: ['day', 'morning', 'night', 'alien', 'space'] },
}, { uuid })

const { state: skyboxTexture } = useTexture(computed(() => `/textures/skybox/skybox-${skySkybox.value}.png`))

watch(skyboxTexture, (tex) => {
  if (!tex) return
  tex.mapping = EquirectangularReflectionMapping
  tex.colorSpace = SRGBColorSpace
  scene.value.background = tex
}, { immediate: true })

const environment = useEnvironmentStore()

const { windAngle, windStrength, windVariability } = useControls('wind', {
  angle: { value: environment.baseWindAngle, min: -Math.PI, max: Math.PI, step: 0.01, type: 'range' },
  strength: { value: environment.baseWindStrength, min: 0, max: 1, step: 0.01, type: 'range' },
  variability: { value: environment.windVariability, min: 0, max: 2, step: 0.01, type: 'range' },
}, { uuid })

watch(windAngle, (v) => environment.setWind({ angle: v }))
watch(windStrength, (v) => environment.setWind({ strength: v }))
watch(windVariability, (v) => environment.setWind({ variability: v }))

// world-aligned trample map: characters stamp it, grass/foliage bend where it's marked
const trampleMap = createTrampleMap({ size: 30, resolution: 256 })

// debug view: the texture's backing canvas rendered live in the bottom-right corner
const { trampleDebug } = useControls('trample', {
  debug: { value: false, type: 'boolean' },
}, { uuid })

const trampleCanvas = trampleMap.texture.image as HTMLCanvasElement
watch(trampleDebug, (show) => {
  if (show) {
    Object.assign(trampleCanvas.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      width: '200px',
      height: '200px',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      borderRadius: '4px',
      zIndex: '100',
      pointerEvents: 'none',
    })
    document.body.appendChild(trampleCanvas)
  }
  else {
    trampleCanvas.remove()
  }
})

onUnmounted(() => {
  trampleCanvas.remove()
  trampleMap.dispose()
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  environment.tickWind(delta)
  trampleMap.update(delta)
  for (const entity of characterEntities.value) {
    const pos = getCharacterRef(entity.id)?.getPosition()
    if (pos) trampleMap.stamp(pos.x, pos.z)
  }
  const leaderPos = gameStore.selectedEntityId
    ? getCharacterRef(gameStore.selectedEntityId)?.getPosition()
    : null
  if (leaderPos) trampleMap.setInteractor(leaderPos.x, leaderPos.z)
})

const { lightX, lightY, lightZ } = useControls('light', {
  x: { value: 5, type: 'number' },
  y: { value: 5, type: 'number' },
  z: { value: 5, type: 'number' },
}, { uuid })

const lightingDirection = computed(() =>
  new Vector3(-lightX.value, -lightY.value, -lightZ.value).normalize()
)

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('cedric', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('character_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })

  // sit in the grass: sit-down once, then idle loop when the clip finishes.
  // animation packs load async, so wait until the sit action exists
  await until(() => getCharacterRef(playerId)?.actions[AnimationName.SIT_FLOOR_DOWN]).toBeTruthy()
  const character = getCharacterRef(playerId)!
  const mixer = character.actions[AnimationName.SIT_FLOOR_DOWN]!.getMixer()
  character.play(AnimationName.SIT_FLOOR_DOWN, { once: true })
  const onFinished = (event: { action: AnimationAction }) => {
    // match by clip name: pack loads can recreate action instances mid-play
    if (event.action.getClip().name !== AnimationName.SIT_FLOOR_DOWN) return
    mixer.removeEventListener('finished', onFinished)
    character.play(AnimationName.SIT_FLOOR_IDLE, { timeScale: 0.5 })
  }
  mixer.addEventListener('finished', onFinished)
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
    :trample="trampleMap"
  />
  <!-- diffuseMap presence is decided at material creation, so wait for the texture -->
  <Grass
    v-if="grassDiffuseMap"
    :subdivisions="400"
    :size="fieldSize"
    :color-a="grassColorA"
    :color-b="grassColorB"
    :diffuse-map="grassDiffuseMap"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
  />
  <GrassTufts
    :subdivisions="20"
    :size="fieldSize"
    :density="tuftsDensity"
    :height="tuftsHeight"
    :spread="tuftsSpread"
    :color-a="tuftsColorA"
    :color-b="tuftsColorB"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
  />
  <Flowers
    shape="puff"
    :subdivisions="70"
    :size="fieldSize"
    :density="puffsDensity"
    :height="puffsHeight"
    :petal-color="puffsColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
  />
  <Flowers
    shape="poppy"
    :subdivisions="60"
    :size="fieldSize"
    :density="poppiesDensity"
    :height="poppiesHeight"
    :petal-color="poppiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
  />
  <Flowers
    shape="daisy"
    :subdivisions="60"
    :size="fieldSize"
    :density="daisiesDensity"
    :height="daisiesHeight"
    :petal-color="daisiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
  />
  <WindLines
    :wind-angle="environment.windAngle"
    :intensity="environment.windStrength"
    :radius="15"
    :height="2"
  />
</template>
