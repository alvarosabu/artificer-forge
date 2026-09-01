<script setup lang="ts">
import { Group, Mesh, SRGBColorSpace } from 'three'
import type { Color, DirectionalLight, Object3D, Texture } from 'three'
import type { TresPointerEvent } from '@tresjs/core'
import { TargetIndicator } from '@artificer-forge/vfx'
import { applyGradingToModel, Character, createControlMap, createGradingContext, createHeightMap, createScatterFocus, createTerrainUniforms, createTrampleMap, createWaterUniforms, extractCanopyReferences, Flowers, Grass, GrassTufts, readHeightPixels, sampleHeight, sampleHeightAt, TerrainQuadtree, Trees, useEnvironmentStore, useGameStore, useSceneRefs, Water, type ControlMap, type HeightField, type HeightMapMeta, WindLines } from '@artificer-forge/engine/runtime'
import type { DayCycleName } from '~/utils/dayCyclePresets'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { positionWorld, vec4 } from 'three/tsl'
import { refDebounced } from '@vueuse/core'
import type { Ref } from 'vue'

// Copied from public/levels/level-512.height-2048.json (pnpm bake:heightmap); re-bake
// and copy again. size is the 1024 m bounding square because the level is 512 x 1024 m
// and heightUv() divides by one size. rgb, not grey: 138 m over 8 bits terraces hillsides.
const HEIGHT_META: HeightMapMeta = {
  resolution: 2048,
  size: 1024,
  origin: [-7.4813, -244.1614],
  minHeight: -4.7006,
  maxHeight: 133.4328,
  texelSize: 0.5,
  flipY: false,
  encoding: 'rgb',
}
const HEIGHT_MAP_URL = '/levels/level-512.height-2048.rgb.png'

// Smaller window than the height map: control-512.png only paints the 512 m around
// the start. Outside it the paint clamps, so far terrain reads as bare ground.
const LEVEL_SIZE = 512
const LEVEL_ORIGIN: [number, number] = [-7.4813, 11.8386]

// Radius sets draw distance AND density, because the instance count is fixed. Keep
// the grass fade at or past where the day fog saturates (~70 m) so the ring never shows.
const GRASS_RADIUS = 150
const SCATTER_RADIUS = 60

// Two grass rings: curved blades inside NEAR_RADIUS, flat past it. The near grid is
// solved from these two numbers to match the far ring's density (see nearSubdivisions).
const NEAR_RADIUS = 30
const GRASS_SUBDIVISIONS = 1024

// useTexture's ref holds a pixel-less Texture until the file lands; a WebGPU material
// given one throws in bind-group init every frame and leaves a blank page.
function whenLoaded<T extends Texture>(source: { value: T | null | undefined }) {
  return computed(() => (source.value?.image ? source.value : null))
}

const control = shallowRef<ControlMap | null>(null)
const heightField = shallowRef<HeightField | null>(null)

const { state: controlTexture } = useTexture('/levels/control-512.png')

watch(whenLoaded(controlTexture), (texture) => {
  if (texture) {
    control.value = createControlMap({
      texture,
      size: LEVEL_SIZE,
      origin: LEVEL_ORIGIN,
    })
  }
})

const grassMap = whenLoaded(useTexture('/textures/grass.webp').state)
const groundMap = whenLoaded(useTexture('/textures/dirt.webp').state)
const roadMap = whenLoaded(useTexture('/textures/road.webp').state)
const rockMap = whenLoaded(useTexture('/textures/rock.webp').state)
const waterNormalMap = whenLoaded(useTexture('/textures/water-normal.webp').state)
// must match the object name in the Blender level file
const LEVEL_GROUND_NODE = 'Terrain'

const { state: gltf } = useGLTF('/levels/level-512.glb', {
  draco: true,
})
const propsRoot = shallowRef<Object3D | null>(null)
const canopyReferences = shallowRef<Object3D[]>([])
const { state: foliageTexture } = useTexture('/textures/foliage/foliageSDF.png')

const { state: grassDiffuseMap } = useTexture('/textures/grass/splat.jpg')
watch(grassDiffuseMap, (tex) => {
  if (tex) tex.colorSpace = SRGBColorSpace
}, { immediate: true })

watch(gltf, (loaded) => {
  if (!loaded) return

  const ground = loaded.scene.getObjectByName(LEVEL_GROUND_NODE)
  // fail loudly: a silent miss leaves the authored terrain z-fighting the generated one
  if (!(ground instanceof Mesh)) {
    console.error(`[terrain] no mesh named "${LEVEL_GROUND_NODE}" in the level GLB`)
    return
  }

  // The ground mesh is skipped: TerrainQuadtree generates the surface from the height
  // map. Clone rather than reparent: useGLTF caches the scene by url, and moving
  // nodes out of it would empty the cached copy on the next HMR pass.
  const scenery = new Group()
  scenery.position.copy(loaded.scene.position)
  scenery.quaternion.copy(loaded.scene.quaternion)
  scenery.scale.copy(loaded.scene.scale)
  for (const child of loaded.scene.children) {
    if (child !== ground) scenery.add(child.clone())
  }

  // Before propsRoot is published, or the grading watcher builds materials for
  // marker balls that are about to be removed.
  canopyReferences.value = extractCanopyReferences(scenery)

  propsRoot.value = scenery
}, { immediate: true })

const { state: heightTexture } = useTexture(HEIGHT_MAP_URL)

watch(whenLoaded(heightTexture), (texture) => {
  if (!texture || heightField.value) return
  heightField.value = createHeightMap({ texture, meta: HEIGHT_META })
})

// sampleHeightAt mirrors the shader's sampling, so the character stands on the
// same surface the GPU draws.
function groundHeight(x: number, z: number): number | null {
  const field = heightField.value
  if (!field) return null
  const pixels = readHeightPixels(field)
  if (!pixels) return null
  return sampleHeightAt(field, pixels, x, z)
}

// Grading's contact occlusion assumes ground at y = 0 and bakes once when the rig
// loads, so the template gates the characters on this or they read as buried.
const characterGroundHeight = computed(() =>
  heightField.value ? sampleHeight(heightField.value, positionWorld.xz) : null)

const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()
const playerId = shallowRef<string | null>(null)

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'))

onMounted(async () => {
  // y is ignored: the grounding pass below overwrites it every frame
  const id = await gameStore.spawnFromTemplate('cedric', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(id)
  gameStore.selectEntity(id)
  playerId.value = id
})

// Keep the hit height: the controller steers XZ only, and the marker needs y.
function handleGroundClick(event: TresPointerEvent) {
  const id = playerId.value
  if (!id || !event.point) return
  getCharacterRef(id)?.moveTo(event.point)
}

const moveTargetPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.getEntity(playerId.value ?? '')?.moveTarget
  if (!target) return null
  return [target.x, target.y + 0.01, target.z]
})

const { uuid } = useSharedLechesControls()
const { scene } = useTresContext()

const environment = useEnvironmentStore()
const dayCycle = useDayCycle()

// presets give fog near/far as ratios of this span, so tune it by where the haze should land
const grading = createGradingContext({ sceneNear: 50, sceneFar: 1000 })

watch(scene, (s) => {
  if (!s) return
  s.background = null // never leave a texture fighting the node
  s.backgroundNode = grading.fogColor
}, { immediate: true })

// Contact occlusion needs the terrain height per fragment: these rocks sit 4 to 6 m
// below y = 0 and the default (ground at 0) would darken them as buried.
watch([propsRoot, characterGroundHeight], ([root, ground]) => {
  if (!root || !ground) return
  applyGradingToModel(root, grading, { groundHeight: ground })
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
  })
})

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
  sceneFar: { value: 1000, min: 1, max: 3000, step: 0.5, type: 'range' },
}, { uuid })

watch(fogSceneNear!, (v) => { grading.range.sceneNear = v })
watch(fogSceneFar!, (v) => { grading.range.sceneFar = v })

// segments rebuilds the shared grid, so it remounts via :key. depth 6 is one vertex
// per texel (1024 / (32 * 2^6) = 0.5 m); deeper only reads each texel twice.
const { quadtreeSegments, quadtreeDepth, quadtreeSplit, quadtreeSkirt, quadtreeWireframe } = useControls('quadtree', {
  segments: { value: 32, min: 4, max: 64, step: 4, type: 'range' },
  depth: { value: 6, min: 0, max: 8, step: 1, type: 'range' },
  split: { value: 1.5, min: 0.5, max: 6, step: 0.1, type: 'range' },
  skirt: { value: 4, min: 0, max: 40, step: 0.25, type: 'range' },
  wireframe: { value: false, type: 'boolean' },
}, { uuid })

// The material is built once (its graph bakes in which maps exist), so every knob
// below must be a uniform.
const terrain = createTerrainUniforms()
const water = createWaterUniforms()

function bindColor(source: Ref<string>, target: { value: Color }) {
  watch(source, hex => target.value.set(hex))
}
function bindNumber(source: Ref<number>, target: { value: number }) {
  watch(source, (v) => { target.value = v })
}

// defaults are read from the uniforms so the panel cannot drift from the material
function hex(u: { value: Color }) {
  return `#${u.value.getHexString()}`
}

// dark/light only apply without a map; this page loads all four, so tint is the live knob
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

// low/high is the ramp band. grass/road read the control map, rock reads normal.y
const {
  blendGrassLow, blendGrassHigh, blendRoadLow, blendRoadHigh,
  blendRockLow, blendRockHigh, blendEdge,
} = useControls('blend', {
  grassLow: { value: terrain.grassBlendLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  grassHigh: { value: terrain.grassBlendHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  roadLow: { value: terrain.roadBlendLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  roadHigh: { value: terrain.roadBlendHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  rockLow: { value: terrain.slopeStart.value, min: 0, max: 1, step: 0.01, type: 'range' },
  rockHigh: { value: terrain.slopeEnd.value, min: 0, max: 1, step: 0.01, type: 'range' },
  edge: { value: terrain.edgeStrength.value, min: 0, max: 2, step: 0.05, type: 'range' },
}, { uuid })

bindNumber(blendGrassLow!, terrain.grassBlendLow)
bindNumber(blendGrassHigh!, terrain.grassBlendHigh)
bindNumber(blendRoadLow!, terrain.roadBlendLow)
bindNumber(blendRoadHigh!, terrain.roadBlendHigh)
bindNumber(blendRockLow!, terrain.slopeStart)
bindNumber(blendRockHigh!, terrain.slopeEnd)
bindNumber(blendEdge!, terrain.edgeStrength)

// Damp ring on the terrain, not the water plane; above/below are metres from the water line
const { shoreColor, shoreLow, shoreHigh, shoreAbove, shoreBelow } = useControls('shore', {
  color: { value: hex(terrain.wetGround), type: 'color' },
  low: { value: terrain.shoreLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  high: { value: terrain.shoreHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  above: { value: terrain.dampAbove.value, min: 0, max: 2, step: 0.01, type: 'range' },
  below: { value: terrain.dampBelow.value, min: -4, max: 0, step: 0.01, type: 'range' },
}, { uuid })

bindColor(shoreColor!, terrain.wetGround)
bindNumber(shoreLow!, terrain.shoreLow)
bindNumber(shoreHigh!, terrain.shoreHigh)
bindNumber(shoreAbove!, terrain.dampAbove)
bindNumber(shoreBelow!, terrain.dampBelow)

// absorption is the colour eaten, so the surface reads as its complement. level feeds
// both the plane's Y and terrain.waterLevel; they must agree or the damp ring detaches.
const { waterLevel,
  waterAbsorption,
  waterStrength,
  waterDepth,
  waterEdgeLow,
  waterEdgeHigh,
  waterRipplesScale,
  waterRipplesStrength,
  waterRipplesSpeed,
  waterRefraction,
} = useControls('water', {
  level: { value: -1, min: -6, max: 2, step: 0.01, type: 'range' },
  absorption: { value: hex(water.absorption), type: 'color' },
  strength: { value: water.absorbStrength.value, min: 0, max: 3, step: 0.01, type: 'range' },
  depth: { value: water.maxDepth.value, min: 0.5, max: 30, step: 0.1, type: 'range' },
  edgeLow: { value: water.maskLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  edgeHigh: { value: water.maskHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  ripplesScale: { value: water.rippleScale.value, min: 0.1, max: 2, step: 0.01, type: 'range' },
  ripplesStrength: { value: water.rippleStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
  ripplesSpeed: { value: water.rippleSpeed.value, min: 0, max: 0.1, step: 0.01, type: 'range' },
  refraction: { value: water.refraction.value, min: 0, max: 6, step: 0.05, type: 'range' },
}, { uuid })

bindColor(waterAbsorption!, water.absorption)
bindNumber(waterStrength!, water.absorbStrength)
bindNumber(waterDepth!, water.maxDepth)
bindNumber(waterEdgeLow!, water.maskLow)
bindNumber(waterEdgeHigh!, water.maskHigh)
bindNumber(waterLevel!, terrain.waterLevel)
bindNumber(waterRipplesScale!, water.rippleScale)
bindNumber(waterRipplesStrength!, water.rippleStrength)
bindNumber(waterRipplesSpeed!, water.rippleSpeed)
bindNumber(waterRefraction!, water.refraction)
// the panel opens before the first watch fires, so seed the terrain's copy now
terrain.waterLevel.value = toValue(waterLevel!)

// depth is metres of water, not distance; color doubles as the strength knob
const {
  foamColor,
  foamDepth,
  foamEdge,
  foamLines,
  foamWidth,
  foamDrift,
  foamWobble,
} = useControls('foam', {
  color: { value: hex(water.foamColor), type: 'color' },
  depth: { value: water.foamDepth.value, min: 0.05, max: 4, step: 0.01, type: 'range' },
  edge: { value: water.foamEdge.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  lines: { value: water.foamLines.value, min: 1, max: 12, step: 1, type: 'range' },
  width: { value: water.foamWidth.value, min: 0.02, max: 1, step: 0.01, type: 'range' },
  drift: { value: water.foamDrift.value, min: 0, max: 2, step: 0.01, type: 'range' },
  wobble: { value: water.foamWobble.value, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

bindColor(foamColor!, water.foamColor)
bindNumber(foamDepth!, water.foamDepth)
bindNumber(foamEdge!, water.foamEdge)
bindNumber(foamLines!, water.foamLines)
bindNumber(foamWidth!, water.foamWidth)
bindNumber(foamDrift!, water.foamDrift)
bindNumber(foamWobble!, water.foamWobble)

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

// Placement reads the same control.g band the ground blends grass with, so nothing
// grows on road or water. leches folder names must stay single-word to destructure.
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

// a 512² canvas is re-uploaded on every fade frame; drop the resolution first if it bites
const trampleMap = createTrampleMap({ size: 60, resolution: 512 })

// One centre for every scatter field: a fixed blade budget over the whole level is
// haze, wrapped around the party leader it is a lawn.
const scatterFocus = createScatterFocus()

// Radius is baked into the grid anchors, so changing it rebuilds the geometry (the
// fields are keyed on it). Debounced so a drag does not rebuild 270k blades per tick.
const { scatterGrassRadius, scatterNearRadius, scatterFlowerRadius, scatterFade } = useControls('scatter', {
  grassRadius: { value: GRASS_RADIUS, min: 20, max: 200, step: 5, type: 'range' },
  nearRadius: { value: NEAR_RADIUS, min: 5, max: 80, step: 5, type: 'range' },
  flowerRadius: { value: SCATTER_RADIUS, min: 10, max: 100, step: 5, type: 'range' },
  // fraction of the radius; 1 = hard cut
  fade: { value: 0.85, min: 0.3, max: 1, step: 0.01, type: 'range' },
}, { uuid })

const grassRadius = refDebounced(scatterGrassRadius as Ref<number>, 250)
const nearRadius = refDebounced(scatterNearRadius as Ref<number>, 250)
const flowerRadius = refDebounced(scatterFlowerRadius as Ref<number>, 250)

// Solved, not tuned: holds the far ring's blades per m² so the crossfade shows no density step.
const nearSubdivisions = computed(() =>
  Math.max(4, Math.round(GRASS_SUBDIVISIONS * nearRadius.value / grassRadius.value)))

watch(scatterFade!, (value) => { scatterFocus.setFadeStart(value as number) })

// farWidth only scales the far ring: a flat blade reads thinner than a curved one at
// the same width. No far height knob on purpose: the crossfade would show the step.
const { bladesWidth, bladesFarWidth, bladesHeight, bladesRandomness, bladesRootShade } = useControls('blades', {
  width: { value: 0.1, min: 0.01, max: 0.4, step: 0.005, type: 'range' },
  farWidth: { value: 1.3, min: 0.5, max: 3, step: 0.05, type: 'range' },
  height: { value: 0.6, min: 0.1, max: 2.5, step: 0.05, type: 'range' },
  randomness: { value: 0.6, min: 0, max: 1, step: 0.01, type: 'range' },
  // not a cast shadow: root AO that rides the engine's misleadingly named shadowIntensity
  rootShade: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

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

// leafSize and amount are baked into the cluster geometry, so they rebuild; colours are live
const { treesColorA, treesColorB, treesAmount, treesLeafSize, treesCanopyScale } = useControls('trees', {
  colorA: { value: '#6bd54d', type: 'color' },
  colorB: { value: '#86b544', type: 'color' },
  amount: { value: 150, min: 20, max: 400, step: 10, type: 'range' },
  leafSize: { value: 0.5, min: 0.1, max: 1.5, step: 0.01, type: 'range' },
  canopyScale: { value: 1, min: 0.4, max: 2, step: 0.01, type: 'range' },
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

// the ortho frustum must cover the level and its height range or the hills self-shadow nothing
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
// Priority 10 runs after Character.vue's movement update (default 0); the other
// order grounds the character against last frame's position.
onBeforeRender(() => {
  const id = playerId.value
  if (!id) return
  const position = getCharacterRef(id)?.getPosition()
  if (!position) return
  const y = groundHeight(position.x, position.z)
  if (y !== null) position.y = y
}, 10)

// Same priority 10, so the stamp lands where the character is now, not last frame.
onBeforeRender(({ delta }) => {
  trampleMap.update(delta)
  for (const entity of characterEntities.value) {
    const pos = getCharacterRef(entity.id)?.getPosition()
    if (pos) trampleMap.stamp(pos.x, pos.z)
  }
  const leaderPos = playerId.value ? getCharacterRef(playerId.value)?.getPosition() : null
  if (leaderPos) {
    trampleMap.setInteractor(leaderPos.x, leaderPos.z)
    scatterFocus.set(leaderPos.x, leaderPos.z)
  }
}, 10)

onUnmounted(() => {
  heightField.value?.dispose()
  trampleCanvas.remove()
  trampleMap.dispose()
})
</script>

<template>
  <!-- no ambient light: graded materials discard lighting, the sun only drives the shadow map -->
  <TresDirectionalLight
    ref="directionalLightRef"
    :intensity="1.2"
    cast-shadow
  />
  <!-- Every map must be loaded before mount: the material bakes in which maps exist,
       so a late one silently falls back to flat colour. -->
  <TerrainQuadtree
    v-if="control && heightField && grassMap && groundMap && roadMap && rockMap"
    :key="quadtreeSegments"
    :field="heightField"
    :control="control"
    :grading="grading"
    :grass-map="grassMap"
    :ground-map="groundMap"
    :road-map="roadMap"
    :rock-map="rockMap"
    :uniforms="terrain"
    :segments="quadtreeSegments"
    :max-depth="quadtreeDepth"
    :split-factor="quadtreeSplit"
    :skirt-depth="quadtreeSkirt"
    :wireframe="quadtreeWireframe"
    @click="handleGroundClick"
  />
  <primitive
    v-if="propsRoot"
    :object="propsRoot"
  />
  <Trees
    :references="canopyReferences"
    :foliage-texture="foliageTexture"
    :grading="grading"
    :color-a="treesColorA"
    :color-b="treesColorB"
    :amount="treesAmount"
    :leaf-size="treesLeafSize"
    :canopy-scale="treesCanopyScale"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <TargetIndicator
    v-if="moveTargetPosition"
    :position="moveTargetPosition"
    :radius="0.8"
    :height="1.2"
    :pulse-speed="3"
  />
  <template v-if="characterGroundHeight">
    <Character
      v-for="entity in characterEntities"
      :ref="(el: any) => setCharacterRef(entity.id, el)"
      :key="entity.id"
      :entity-id="entity.id"
      :grading="grading"
      :ground-height="characterGroundHeight"
    />
  </template>
 <!-- Keyed on the radii: they are baked into the anchors, and innerSize into the far
      ring's node graph. The splat spans the level so its variation does not tile. -->
 <Grass
    v-if="control && heightField && grassDiffuseMap"
    :key="`near-${nearRadius}-${grassRadius}`"
    :subdivisions="nearSubdivisions"
    blade-detail="curved"
    :diffuse-map="grassDiffuseMap"
    :diffuse-map-size="LEVEL_SIZE"
    :size="nearRadius * 2"
    :focus="scatterFocus"
    :blade-width="bladesWidth"
    :blade-height="bladesHeight"
    :blade-height-randomness="bladesRandomness"
    :shadow-intensity="bladesRootShade"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
    :mask-low="0.25"
    :mask-high="0.6"
  />
 <Grass
    v-if="control && heightField && grassDiffuseMap"
    :key="`far-${nearRadius}-${grassRadius}`"
    :subdivisions="GRASS_SUBDIVISIONS"
    blade-detail="flat"
    :diffuse-map="grassDiffuseMap"
    :diffuse-map-size="LEVEL_SIZE"
    :size="grassRadius * 2"
    :inner-size="nearRadius * 2"
    :focus="scatterFocus"
    :blade-width="bladesWidth * bladesFarWidth"
    :blade-height="bladesHeight"
    :blade-height-randomness="bladesRandomness"
    :shadow-intensity="bladesRootShade"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
    :mask-low="0.25"
    :mask-high="0.6"
  />
  <!-- Scatter grids are per-species on purpose: a tuft template is ~160 verts
       against a flower's ~60, so tufts stay coarse and lean on density instead -->
  <GrassTufts
    v-if="control && heightField"
    :key="flowerRadius"
    :subdivisions="40"
    :size="flowerRadius * 2"
    :focus="scatterFocus"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
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
    :key="flowerRadius"
    shape="puff"
    :subdivisions="200"
    :size="flowerRadius * 2"
    :focus="scatterFocus"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
    :density="puffsDensity"
    :height="puffsHeight"
    :petal-color="puffsColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Flowers
    v-if="control && heightField"
    :key="flowerRadius"
    shape="poppy"
    :subdivisions="100"
    :size="flowerRadius * 2"
    :focus="scatterFocus"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
    :density="poppiesDensity"
    :height="poppiesHeight"
    :petal-color="poppiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Flowers
    v-if="control && heightField"
    :key="flowerRadius"
    shape="daisy"
    :subdivisions="80"
    :size="flowerRadius * 2"
    :focus="scatterFocus"
    :grading="grading"
    :height-field="heightField"
    :control="control"
    :trample="trampleMap"
    :density="daisiesDensity"
    :height="daisiesHeight"
    :petal-color="daisiesColor"
    :wind-angle="environment.windAngle"
    :wind-strength="environment.windStrength"
  />
  <Water
    v-if="control && waterNormalMap"
    :control="control"
    :level="waterLevel"
    :grading="grading"
    :uniforms="water"
    :normal-map="waterNormalMap"
  />
  <WindLines
    :wind-angle="environment.windAngle"
    :intensity="environment.windStrength"
    :radius="15"
    :height="2"
  /> 
  <!-- <TresMesh v-if="heightField" :position="[0, 20, 0]" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[60, 60]" />
    <primitive :object="createHeightFieldPreview(heightField)" attach="material" />
  </TresMesh> -->
</template>
