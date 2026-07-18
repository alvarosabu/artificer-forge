<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { until } from '@vueuse/core'
import { Object3D, SRGBColorSpace } from 'three'
import type { AmbientLight, AnimationAction, DirectionalLight } from 'three'
import { AnimationName, Character, createGradingContext, createTrampleMap, Floor, Foliage, Grass, useEnvironmentStore, useGameStore, useSceneRefs, WindLines } from '@artificer-forge/engine/runtime'
import type { DayCycleName } from '~/utils/dayCyclePresets'


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

// one folder for the whole cycle: preset jump, auto time passing, sun orbit
// shape (useDayCycle reads sun/auto every tick, plain mutation works)
const {
  dayCyclePreset,
  dayCycleAuto,
  dayCycleDuration,
  dayCycleOrbit,
  dayCycleTheta,
  dayCyclePhi,
  dayCycleThetaAmplitude,
  dayCyclePhiAmplitude,
} = useControls('dayCycle', {
  preset: {
    value: 'day',
    options: [
      { text: '☀️ Day', alias: 'day', value: 'day' },
      { text: '🌆 Dusk', alias: 'dusk', value: 'dusk' },
      { text: '🌙 Night', alias: 'night', value: 'night' },
      { text: '🌅 Dawn', alias: 'dawn', value: 'dawn' },
    ],
  },
  auto: { value: dayCycle.auto.running, type: 'boolean' },
  duration: { value: dayCycle.auto.duration, min: 10, max: 600, step: 1, type: 'range' },
  orbit: { value: dayCycle.sun.orbit, type: 'boolean' },
  theta: { value: dayCycle.sun.theta, min: -Math.PI, max: Math.PI, step: 0.01, type: 'range' },
  phi: { value: dayCycle.sun.phi, min: 0.05, max: 1.45, step: 0.01, type: 'range' },
  thetaAmplitude: { value: dayCycle.sun.thetaAmplitude, min: 0, max: Math.PI, step: 0.01, type: 'range' },
  phiAmplitude: { value: dayCycle.sun.phiAmplitude, min: 0, max: Math.PI, step: 0.01, type: 'range' },
}, { uuid })

watch(dayCyclePreset!, name => dayCycle.transitionTo(name as DayCycleName))
watch(dayCycleAuto!, (v) => { dayCycle.auto.running = v })
watch(dayCycleDuration!, (v) => { dayCycle.auto.duration = v })
watch(dayCycleOrbit!, (v) => { dayCycle.sun.orbit = v })
watch(dayCycleTheta!, (v) => { dayCycle.sun.theta = v })
watch(dayCyclePhi!, (v) => { dayCycle.sun.phi = v })
watch(dayCycleThetaAmplitude!, (v) => { dayCycle.sun.thetaAmplitude = v })
watch(dayCyclePhiAmplitude!, (v) => { dayCycle.sun.phiAmplitude = v })
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
// folder name must be a single word: leches returns keys as `${folder}${Capitalized(control)}`
const { rampShadowLow, rampShadowHigh, rampMidLow, rampMidHigh, rampMidStrength, rampHardness } = useControls('ramp', {
  shadowLow: { value: 0, min: -1, max: 1, step: 0.01, type: 'range' },
  shadowHigh: { value: 0.25, min: -1, max: 1, step: 0.01, type: 'range' },
  midLow: { value: -0.35, min: -1, max: 1, step: 0.01, type: 'range' },
  midHigh: { value: -0.15, min: -1, max: 1, step: 0.01, type: 'range' },
  midStrength: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  hardness: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watch(rampShadowLow!, (v) => { grading.uniforms.shadowEdgeLow.value = v })
watch(rampShadowHigh!, (v) => { grading.uniforms.shadowEdgeHigh.value = v })
watch(rampMidLow!, (v) => { grading.uniforms.midEdgeLow.value = v })
watch(rampMidHigh!, (v) => { grading.uniforms.midEdgeHigh.value = v })
watch(rampMidStrength!, (v) => { grading.uniforms.midStrength.value = v })
watch(rampHardness!, (v) => { grading.uniforms.rampHardness.value = v })

const { toonRimStrength, toonRimPower, toonSpecStrength, toonSpecShininess, toonAoStrength } = useControls('toon', {
  rimStrength: { value: 0.25, min: 0, max: 1, step: 0.01, type: 'range' },
  rimPower: { value: 3, min: 0.5, max: 8, step: 0.1, type: 'range' },
  specStrength: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
  specShininess: { value: 32, min: 2, max: 128, step: 1, type: 'range' },
  aoStrength: { value: 1, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watch(toonRimStrength!, (v) => { grading.uniforms.rimStrength.value = v })
watch(toonRimPower!, (v) => { grading.uniforms.rimPower.value = v })
watch(toonSpecStrength!, (v) => { grading.uniforms.specStrength.value = v })
watch(toonSpecShininess!, (v) => { grading.uniforms.specShininess.value = v })
watch(toonAoStrength!, (v) => { grading.uniforms.aoStrength.value = v })



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
    // the sun must aim exactly along grading.lightDirection or drop shadows and
    // the finish's core shadow would disagree; distance 20 keeps the ortho
    // shadow frustum (near 1 / far 60) around the scene
    directional.position.copy(environment.lightDirection).multiplyScalar(-20)
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

// drop-shadow map tuning (Bruno's defaults); position/direction is not tunable —
// it's locked to grading.lightDirection in syncLights
const { shadowsAmplitude, shadowsBias, shadowsNormalBias, shadowsRadius } = useControls('shadows', {
  amplitude: { value: 15, min: 1, max: 50, step: 0.5, type: 'range' },
  bias: { value: -0.001, min: -0.02, max: 0.02, step: 0.0001, type: 'range' },
  normalBias: { value: 0.1, min: -0.3, max: 0.3, step: 0.01, type: 'range' },
  radius: { value: 3, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

function applyShadowConfig() {
  const light = directionalLightRef.value
  if (!light) return
  const amplitude = toValue(shadowsAmplitude!)
  const cam = light.shadow.camera
  cam.top = amplitude
  cam.right = amplitude
  cam.bottom = -amplitude
  cam.left = -amplitude
  cam.near = 1
  cam.far = 60
  cam.updateProjectionMatrix()
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.bias = toValue(shadowsBias!)
  light.shadow.normalBias = toValue(shadowsNormalBias!)
  light.shadow.radius = toValue(shadowsRadius!)
}

watch([directionalLightRef, shadowsAmplitude!, shadowsBias!, shadowsNormalBias!, shadowsRadius!], applyShadowConfig)

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
