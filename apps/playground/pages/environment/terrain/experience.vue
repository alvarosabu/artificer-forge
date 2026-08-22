<script setup lang="ts">
import { Mesh, Raycaster, SRGBColorSpace, Vector3 } from 'three'
import type { BufferGeometry, Color, DirectionalLight } from 'three'
import type { TresPointerEvent } from '@tresjs/core'
import { TargetIndicator } from '@artificer-forge/vfx'
import { Character, createControlMap, createGradingContext, createHeightField, createTerrainUniforms, Flowers, Grass, GrassTufts, sampleHeight, TerrainGround, useEnvironmentStore, useGameStore, useSceneRefs, WaterSurface, type ControlMap, type HeightField } from '@artificer-forge/engine/runtime'
import type { DayCycleName } from '~/utils/dayCyclePresets'
import { MeshBasicNodeMaterial, type WebGPURenderer } from 'three/webgpu'
import { positionWorld, vec4 } from 'three/tsl'

const control = shallowRef<ControlMap | null>(null)
const { renderer } = useTresContext()
const heightField = shallowRef<HeightField | null>(null)

const { state: controlTexture } = useTexture('/levels/testbed.control.png')

watch(controlTexture, (texture) => {
  if (texture) {
    control.value = createControlMap({
      texture,
      size: 60,
    })
  }
})

const { state: grassMap } = useTexture('/textures/grass.png')
const { state: groundMap } = useTexture('/textures/dirt.webp')
const { state: roadMap } = useTexture('/textures/road.jpg')
const { state: rockMap } = useTexture('/textures/rock.webp')

const { state: gltf } = useGLTF('/levels/testbed.glb')
const groundGeometry = shallowRef<BufferGeometry | null>(null)

const { state: grassDiffuseMap } = useTexture('/textures/grass/splat.jpg')
watch(grassDiffuseMap, (tex) => {
  if (tex) tex.colorSpace = SRGBColorSpace
}, { immediate: true })

watch(gltf, (loaded) => {
  if (!loaded) return

  // collect into an array rather than assigning to an outer variable: TypeScript
  // cannot narrow a value written inside a callback
  const meshes: Mesh[] = []
  loaded.scene.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child)
  })
  const ground = meshes[0]
  if (!ground) return

  // bake the node transform into the vertices, so local space == world space
  ground.updateWorldMatrix(true, false)
  const geometry = ground.geometry.clone()
  geometry.applyMatrix4(ground.matrixWorld)
  groundGeometry.value = geometry
}, { immediate: true })

// --- Character, for scale and for walking the level ---

// A raycast target, deliberately NOT added to the scene. The geometry already has
// its world transform baked in above, so an identity mesh sits exactly where
// TerrainGround draws it. This is the slow-but-correct ground query: one ray
// against every triangle. The baked height field replaces it later.
const groundPicker = shallowRef<Mesh | null>(null)
watch(groundGeometry, (geometry) => {
  if (!geometry) return
  const mesh = new Mesh(geometry)
  mesh.updateMatrixWorld()
  groundPicker.value = mesh
})

watch([groundGeometry, () => renderer.instance], async ([geometry, gpu]) => {
  if (!geometry || !gpu || heightField.value) return
  // the same 60 metres and the same origin as the control map, on purpose
  const field = createHeightField({ geometry, size: 60, resolution: 512 })
  await field.bake(gpu as WebGPURenderer)
  heightField.value = field
}, { immediate: true })



const raycaster = new Raycaster()
const _origin = new Vector3()
const _down = new Vector3(0, -1, 0)

// Terrain height under a world XZ, or null when the ray misses the mesh.
// Starts well above the level so it always begins outside the geometry.
function groundHeight(x: number, z: number): number | null {
  const mesh = groundPicker.value
  if (!mesh) return null
  raycaster.set(_origin.set(x, 200, z), _down)
  return raycaster.intersectObject(mesh, false)[0]?.point.y ?? null
}

const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()
const playerId = shallowRef<string | null>(null)

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'))

onMounted(async () => {
  const id = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(id)
  gameStore.selectEntity(id)
  playerId.value = id
})

// Click the ground to walk there. The whole hit point goes in, height included:
// the controller only steers on XZ (the grounding pass below owns y), and keeping
// the clicked height means the destination marker can sit on the terrain.
function handleGroundClick(event: TresPointerEvent) {
  const id = playerId.value
  if (!id || !event.point) return
  getCharacterRef(id)?.moveTo(event.point)
}

// Destination marker. The terrain page composes its own systems, so it places the
// indicator itself instead of getting CombatSystem's.
const moveTargetPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.getEntity(playerId.value ?? '')?.moveTarget
  if (!target) return null
  return [target.x, target.y + 0.01, target.z]
})

const { uuid } = useSharedLechesControls()
const { scene } = useTresContext()

const environment = useEnvironmentStore()
const dayCycle = useDayCycle()

// presets give fog near/far as RATIOS of this span, so the range is solved
// backwards from where fog should land: the overview camera sits ~50m out, so
// day's 0.315/1.25 over span 55 starts the haze at ~67m and saturates past the
// far edge — only the last stretch of ground dissolves, not the whole level
const grading = createGradingContext({ sceneNear: 50, sceneFar: 105 })

watch(scene, (s) => {
  if (!s) return
  s.background = null                    // never leave a texture fighting the node
  s.backgroundNode = grading.fogColor    // sky IS the fog gradient
}, { immediate: true })

const { dayCyclePreset, dayCycleAuto } = useControls('dayCycle', {
  preset: {
    value: 'day',
    options: [
      { text: '☀️ Day', alias: 'day', value: 'day' },
      { text: '🌆 Dusk', alias: 'dusk', value: 'dusk' },
      { text: '🌙 Night', alias: 'night', value: 'night' },
      { text: '🌅 Dawn', alias: 'dawn', value: 'dawn' },
    ],
  },
  auto: { value: false, type: 'boolean' },
}, { uuid })

dayCycle.auto.running = false

watch(dayCyclePreset!, name => dayCycle.transitionTo(name as DayCycleName))
watch(dayCycleAuto!, (v) => { dayCycle.auto.running = v })

const { fogSceneNear, fogSceneFar } = useControls('fog', {
  sceneNear: { value: 50, min: 0, max: 200, step: 0.5, type: 'range' },
  sceneFar: { value: 105, min: 1, max: 300, step: 0.5, type: 'range' },
}, { uuid })

watch(fogSceneNear!, (v) => { grading.range.sceneNear = v })
watch(fogSceneFar!, (v) => { grading.range.sceneFar = v })

// terrain look: one uniform bag, written into live. The material is built once
// (its node graph bakes in which maps exist), so every knob here has to be a
// uniform — anything else would need a rebuild.
const terrain = createTerrainUniforms()

// leches gives us plain refs; these just forward them into the uniforms
function bindColor(source: Ref<string>, target: { value: Color }) {
  watch(source, hex => target.value.set(hex))
}
function bindNumber(source: Ref<number>, target: { value: number }) {
  watch(source, (v) => { target.value = v })
}

// control defaults are READ from the uniforms, so the panel always opens on the
// material's own values instead of a second copy that can drift
function hex(u: { value: Color }) {
  return `#${u.value.getHexString()}`
}

// dark/light are the gradient for a surface with NO map, tint multiplies the map
// when there is one — this page loads all four, so tint is the live one here
const { groundDark, groundLight, groundTint, groundTile, groundWarp } = useControls('ground', {
  dark: { value: hex(terrain.groundDark), type: 'color' },
  light: { value: hex(terrain.groundLight), type: 'color' },
  tint: { value: hex(terrain.groundTint), type: 'color' },
  tile: { value: terrain.groundTile.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  warp: { value: terrain.groundWarp.value, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

bindColor(groundDark!, terrain.groundDark)
bindColor(groundLight!, terrain.groundLight)
bindColor(groundTint!, terrain.groundTint)
bindNumber(groundTile!, terrain.groundTile)
bindNumber(groundWarp!, terrain.groundWarp)

const { grassDark, grassLight, grassTint, grassTile, grassWarp } = useControls('grass', {
  dark: { value: hex(terrain.grassDark), type: 'color' },
  light: { value: hex(terrain.grassLight), type: 'color' },
  tint: { value: hex(terrain.grassTint), type: 'color' },
  tile: { value: terrain.grassTile.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  warp: { value: terrain.grassWarp.value, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

bindColor(grassDark!, terrain.grassDark)
bindColor(grassLight!, terrain.grassLight)
bindColor(grassTint!, terrain.grassTint)
bindNumber(grassTile!, terrain.grassTile)
bindNumber(grassWarp!, terrain.grassWarp)

const { roadDark, roadLight, roadTint, roadTile, roadWarp } = useControls('road', {
  dark: { value: hex(terrain.roadDark), type: 'color' },
  light: { value: hex(terrain.roadLight), type: 'color' },
  tint: { value: hex(terrain.roadTint), type: 'color' },
  tile: { value: terrain.roadTile.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  warp: { value: terrain.roadWarp.value, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

bindColor(roadDark!, terrain.roadDark)
bindColor(roadLight!, terrain.roadLight)
bindColor(roadTint!, terrain.roadTint)
bindNumber(roadTile!, terrain.roadTile)
bindNumber(roadWarp!, terrain.roadWarp)

const { rockDark, rockLight, rockTint, rockTile, rockWarp } = useControls('rock', {
  dark: { value: hex(terrain.rockDark), type: 'color' },
  light: { value: hex(terrain.rockLight), type: 'color' },
  tint: { value: hex(terrain.rockTint), type: 'color' },
  tile: { value: terrain.rockTile.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  warp: { value: terrain.rockWarp.value, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

bindColor(rockDark!, terrain.rockDark)
bindColor(rockLight!, terrain.rockLight)
bindColor(rockTint!, terrain.rockTint)
bindNumber(rockTile!, terrain.rockTile)
bindNumber(rockWarp!, terrain.rockWarp)

// Where one surface hands over to the next. low/high is the band the mask ramps
// across: low = where the layer starts showing, high = where it fully wins, so a
// tight pair is a hard border and a wide one a long fade. Grass and road read the
// painted control map, rock reads normal.y, shore reads the water channel.
const {
  blendGrassLow, blendGrassHigh, blendRoadLow, blendRoadHigh,
  blendRockLow, blendRockHigh, blendShoreLow, blendShoreHigh, blendEdge,
} = useControls('blend', {
  grassLow: { value: terrain.grassBlendLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  grassHigh: { value: terrain.grassBlendHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  roadLow: { value: terrain.roadBlendLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  roadHigh: { value: terrain.roadBlendHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  rockLow: { value: terrain.slopeStart.value, min: 0, max: 1, step: 0.01, type: 'range' },
  rockHigh: { value: terrain.slopeEnd.value, min: 0, max: 1, step: 0.01, type: 'range' },
  shoreLow: { value: terrain.shoreLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  shoreHigh: { value: terrain.shoreHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  edge: { value: terrain.edgeStrength.value, min: 0, max: 2, step: 0.05, type: 'range' },
}, { uuid })

bindNumber(blendGrassLow!, terrain.grassBlendLow)
bindNumber(blendGrassHigh!, terrain.grassBlendHigh)
bindNumber(blendRoadLow!, terrain.roadBlendLow)
bindNumber(blendRoadHigh!, terrain.roadBlendHigh)
bindNumber(blendRockLow!, terrain.slopeStart)
bindNumber(blendRockHigh!, terrain.slopeEnd)
bindNumber(blendShoreLow!, terrain.shoreLow)
bindNumber(blendShoreHigh!, terrain.shoreHigh)
bindNumber(blendEdge!, terrain.edgeStrength)

const { shoreColor } = useControls('shore', {
  color: { value: hex(terrain.wetGround), type: 'color' },
}, { uuid })

bindColor(shoreColor!, terrain.wetGround)

// frequencies are cycles per metre: 1 / value is the feature size in metres
const { noiseGrain, noisePatch, noiseRock, noiseWarp } = useControls('noise', {
  grain: { value: terrain.grainFreq.value, min: 0.01, max: 1.5, step: 0.01, type: 'range' },
  patch: { value: terrain.patchFreq.value, min: 0.005, max: 0.5, step: 0.005, type: 'range' },
  rock: { value: terrain.rockFreq.value, min: 0.01, max: 1.5, step: 0.01, type: 'range' },
  warp: { value: terrain.warpFreq.value, min: 0.005, max: 0.3, step: 0.005, type: 'range' },
}, { uuid })

bindNumber(noiseGrain!, terrain.grainFreq)
bindNumber(noisePatch!, terrain.patchFreq)
bindNumber(noiseRock!, terrain.rockFreq)
bindNumber(noiseWarp!, terrain.warpFreq)

// Scattered vegetation. Placement is the SAME control.g band the ground blends
// grass with, so nothing grows on the road or in the water: mask low/high here
// only decides how far into the painted grass a species reaches, density is the
// cutoff against the per-species patch noise. One leches folder per species, and
// folder names have to stay single-word or the keys stop destructuring.
const { tuftsDensity, tuftsHeight, tuftsSpread, tuftsColorA, tuftsColorB } = useControls('tufts', {
  density: { value: 0.35, min: 0, max: 1, step: 0.01, type: 'range' },
  height: { value: 2.2, min: 0.4, max: 4, step: 0.05, type: 'range' },
  spread: { value: 0.45, min: 0.1, max: 1.2, step: 0.01, type: 'range' },
  colorA: { value: '#2f5d2a', type: 'color' },
  colorB: { value: '#7fae3c', type: 'color' },
}, { uuid })

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

const directionalLightRef = shallowRef<DirectionalLight>()

// the sun must aim exactly along grading.lightDirection or the drop shadows and
// the finish's core shadow would disagree about where the light is
function syncLight() {
  const light = directionalLightRef.value
  if (!light) return
  light.color.copy(environment.lightColor)
  light.intensity = 1.2 * environment.lightIntensity
  light.position.copy(environment.lightDirection).multiplyScalar(-60)
}

// ortho frustum sized to the whole level (±30m) plus its height range, otherwise
// the hills fall outside the shadow camera and self-shadow nothing
const { shadowsAmplitude, shadowsBias, shadowsNormalBias, shadowsRadius } = useControls('shadows', {
  amplitude: { value: 45, min: 1, max: 100, step: 0.5, type: 'range' },
  bias: { value: -0.0005, min: -0.02, max: 0.02, step: 0.0001, type: 'range' },
  normalBias: { value: 0.15, min: -0.3, max: 0.3, step: 0.01, type: 'range' },
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
  cam.far = 160
  cam.updateProjectionMatrix()
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.bias = toValue(shadowsBias!)
  light.shadow.normalBias = toValue(shadowsNormalBias!)
  light.shadow.radius = toValue(shadowsRadius!)
}

watch([directionalLightRef, shadowsAmplitude!, shadowsBias!, shadowsNormalBias!, shadowsRadius!], applyShadowConfig)

function createHeightFieldPreview(field: HeightField) {
  const material = new MeshBasicNodeMaterial()
  // metres are not a display range: divide to a rough 0..1 grey so you can see it
  const grey = sampleHeight(field, positionWorld.xz).div(10).add(0.3)
  material.outputNode = vec4(grey, grey, grey, 1)
  return material
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  dayCycle.tick(delta)
  grading.sync(environment) // store keys match GradingProps structurally
  syncLight()
})
// Priority 10 so this runs AFTER Character.vue's own movement update, which sits
// at the default priority of 0. Ordering the other way would ground the character
// against last frame's position. getPosition() hands back the live Vector3 the
// group renders from, so writing y here moves the character.
onBeforeRender(() => {
  const id = playerId.value
  if (!id) return
  const position = getCharacterRef(id)?.getPosition()
  if (!position) return
  const y = groundHeight(position.x, position.z)
  if (y !== null) position.y = y
}, 10)

onUnmounted(() => heightField.value?.dispose())
</script>

<template>
  <!-- no ambient light: graded materials discard the lighting result, the sun is
       here only to drive the shadow map -->
  <TresDirectionalLight
    ref="directionalLightRef"
    :intensity="1.2"
    cast-shadow
  />
  <!-- every map has to be loaded before mount: the material bakes in which maps
       exist, so one arriving late would silently fall back to flat colour -->
  <TerrainGround
    v-if="control && groundGeometry && grassMap && groundMap && roadMap && rockMap"
    :control="control"
    :geometry="groundGeometry"
    :grading="grading"
    :grass-map="grassMap"
    :ground-map="groundMap"
    :road-map="roadMap"
    :rock-map="rockMap"
    :uniforms="terrain"
    @click="handleGroundClick"
  />
  <TargetIndicator
    v-if="moveTargetPosition"
    :position="moveTargetPosition"
    :radius="0.8"
    :height="1.2"
    :pulse-speed="3"
  />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
    :grading="grading"
  />
  <Grass
    v-if="control && heightField && grassDiffuseMap"
    :subdivisions="400"
    :diffuse-map="grassDiffuseMap"
    :size="60"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :mask-low="0.25"
    :mask-high="0.6"
  />
  <!-- Scatter grids are per-species on purpose: a tuft template is ~160 verts
       against a flower's ~60, so tufts stay coarse and lean on density instead -->
  <GrassTufts
    v-if="control && heightField"
    :subdivisions="40"
    :size="60"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :density="tuftsDensity"
    :height="tuftsHeight"
    :spread="tuftsSpread"
    :color-a="tuftsColorA"
    :color-b="tuftsColorB"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Flowers
    v-if="control && heightField"
    shape="puff"
    :subdivisions="140"
    :size="60"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :density="puffsDensity"
    :height="puffsHeight"
    :petal-color="puffsColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Flowers
    v-if="control && heightField"
    shape="poppy"
    :subdivisions="120"
    :size="60"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :density="poppiesDensity"
    :height="poppiesHeight"
    :petal-color="poppiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Flowers
    v-if="control && heightField"
    shape="daisy"
    :subdivisions="120"
    :size="60"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :density="daisiesDensity"
    :height="daisiesHeight"
    :petal-color="daisiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <WaterSurface
    v-if="control"
    :control="control"
    :level="-1.2"
    :grading="grading"
  />
  <!-- <TresMesh v-if="heightField" :position="[0, 20, 0]" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[60, 60]" />
    <primitive :object="createHeightFieldPreview(heightField)" attach="material" />
  </TresMesh> -->
</template>
