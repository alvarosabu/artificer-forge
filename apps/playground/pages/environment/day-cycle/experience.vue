<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { until } from '@vueuse/core'
import { Object3D, SRGBColorSpace } from 'three'
import type { AmbientLight, AnimationAction, DirectionalLight } from 'three'
import { AnimationName, Character, createGradingContext, createTrampleMap, Floor, Foliage, Grass, useEnvironmentStore, useGameStore, useSceneRefs, WindLines } from '@artificer-forge/engine/runtime'
import type { DayCycleName } from '~/utils/dayCiclePresets'


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

const { state: grassDiffuseMap } = useTexture('/textures/grass/splat.jpg')
watch(grassDiffuseMap, (tex) => {
  if (tex) tex.colorSpace = SRGBColorSpace
}, { immediate: true })


const { scene } = useTresContext()

const environment = useEnvironmentStore()
const dayCycle = useDayCycle()

const grading = createGradingContext({ sceneNear: 12, sceneFar: 45 })


watch(scene, (s) => {
    if (!s) return
    s.background = null                    // never leave a texture fighting the node
    s.backgroundNode = grading.fogColor    // sky IS the fog gradient
}, { immediate: true })

const { cyclePreset } = useControls('cycle', {
  preset: {
    value: 'day',
    options: [
      { text: '☀️ Day', alias: 'day', value: 'day' },
      { text: '🌆 Dusk', alias: 'dusk', value: 'dusk' },
      { text: '🌙 Night', alias: 'night', value: 'night' },
      { text: '🌅 Dawn', alias: 'dawn', value: 'dawn' },
    ],
  },
}, { uuid })

watch(cyclePreset!, name => dayCycle.transitionTo(name as DayCycleName))

// screen-space gradient shape — not per-preset, so safe to drive the uniforms
// directly (sync() only writes colors + near/far each frame)
const { fogCenterX, fogCenterY, fogStart, fogEnd, fogSceneNear, fogSceneFar } = useControls('fog', {
  centerX: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  centerY: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  start: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
  end: { value: 1, min: 0, max: 2, step: 0.01, type: 'range' },
  sceneNear: { value: 12, min: 0, max: 60, step: 0.5, type: 'range' },
  sceneFar: { value: 45, min: 1, max: 120, step: 0.5, type: 'range' },
}, { uuid })

watch(fogCenterX!, (v) => { grading.uniforms.radialCenter.value.x = v })
watch(fogCenterY!, (v) => { grading.uniforms.radialCenter.value.y = v })
watch(fogStart!, (v) => { grading.uniforms.radialStart.value = v })
watch(fogEnd!, (v) => { grading.uniforms.radialEnd.value = v })
watch(fogSceneNear!, (v) => { grading.range.sceneNear = v })
watch(fogSceneFar!, (v) => { grading.range.sceneFar = v })

// ramp shape, not per-preset — drive the uniforms directly like the fog shape
const { rampShadowLow, rampShadowHigh, rampMidLow, rampMidHigh, rampMidStrength } = useControls('shadow ramp', {
  shadowLow: { value: -0.25, min: -1, max: 1, step: 0.01, type: 'range' },
  shadowHigh: { value: 0.5, min: -1, max: 1, step: 0.01, type: 'range' },
  midLow: { value: -0.7, min: -1, max: 1, step: 0.01, type: 'range' },
  midHigh: { value: -0.25, min: -1, max: 1, step: 0.01, type: 'range' },
  midStrength: { value: 0.45, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watch(rampShadowLow!, (v) => { grading.uniforms.shadowEdgeLow.value = v })
watch(rampShadowHigh!, (v) => { grading.uniforms.shadowEdgeHigh.value = v })
watch(rampMidLow!, (v) => { grading.uniforms.midEdgeLow.value = v })
watch(rampMidHigh!, (v) => { grading.uniforms.midEdgeHigh.value = v })
watch(rampMidStrength!, (v) => { grading.uniforms.midStrength.value = v })



const { windAngle, windStrength, windVariability } = useControls('wind', {
  angle: { value: environment.baseWindAngle, min: -Math.PI, max: Math.PI, step: 0.01, type: 'range' },
  strength: { value: environment.baseWindStrength, min: 0, max: 1, step: 0.01, type: 'range' },
  variability: { value: environment.windVariability, min: 0, max: 2, step: 0.01, type: 'range' },
}, { uuid })

watch(windAngle!, (v) => environment.setWind({ angle: v }))
watch(windStrength!, (v) => environment.setWind({ strength: v }))
watch(windVariability!, (v) => environment.setWind({ variability: v }))

// world-aligned trample map: characters stamp it, grass/foliage bend where it's marked
const trampleMap = createTrampleMap({ size: 30, resolution: 256 })

// debug view: the texture's backing canvas rendered live in the bottom-right corner
const { trampleDebug } = useControls('trample', {
  debug: { value: false, type: 'boolean' },
}, { uuid })

const trampleCanvas = trampleMap.texture.image as HTMLCanvasElement
watch(trampleDebug!, (show) => {
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

// cycle-driven scene lights for anything NOT on the graded finish (PBR props,
// portrait captures). setGrading mutates Color in place, so template bindings
// can't track it — sync the light objects per frame like the grading uniforms.
const ambientLightRef = shallowRef<AmbientLight>()
const directionalLightRef = shallowRef<DirectionalLight>()

function syncLights() {
  const ambient = ambientLightRef.value
  if (ambient) {
    ambient.color.copy(environment.lightColor)
    ambient.intensity = 0.5 * environment.lightIntensity
  }
  const directional = directionalLightRef.value
  if (directional) {
    directional.color.copy(environment.lightColor)
    directional.intensity = 1.2 * environment.lightIntensity
  }
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  environment.tickWind(delta)
  dayCycle.tick(delta)
  grading.sync(environment) // store keys match GradingProps structurally
  syncLights()
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

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
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
  <TresAmbientLight ref="ambientLightRef" :intensity="0.5" />
  <TresDirectionalLight
    ref="directionalLightRef"
    :position="[lightX, lightY, lightZ]"
    :intensity="1.2"
    cast-shadow
  />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
    :grading="grading"
  />
  <!-- <TresMesh :rotation-x="-Math.PI / 2" :position="[0, 0.01, 0]" receive-shadow>
    <TresPlaneGeometry :args="[20, 20]" />
    <TresMeshStandardMaterial />
  </TresMesh> -->
  <Floor :grading="grading" />
  <Foliage
    :references="references"
    :foliage-texture="foliageTexture"
    :color-a="foliageColorA"
    :color-b="foliageColorB"
    :amount="80"
    :size="0.8"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
    :grading="grading"
  />
  <!-- diffuseMap presence is decided at material creation, so wait for the texture -->
  <Grass
    v-if="grassDiffuseMap"
    :subdivisions="200"
    :size="30"
    :color-a="grassColorA"
    :color-b="grassColorB"
    :diffuse-map="grassDiffuseMap"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
    :trample="trampleMap"
    :grading="grading"
  />
  <WindLines
    :wind-angle="environment.windAngle"
    :intensity="environment.windStrength"
    :radius="15"
    :height="2"
  />
</template>
