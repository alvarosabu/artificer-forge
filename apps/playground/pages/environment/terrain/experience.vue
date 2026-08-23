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

// The terrain is GENERATED from this map, not loaded from the GLB. Everything
// below is a transcription of public/levels/level-512.height-2048.json, written by
// `pnpm bake:heightmap apps/playground/public/levels/level-512.glb` — the image
// alone has no scale, so these numbers are the only thing tying its 0..1 back to
// metres. Re-bake and they have to be copied across again.
//
// The FULL extent. level-512.glb is 512 x 1024 m (the terrain was duplicated along
// Z, and the halves meet at z = -244), and heightUv() divides by ONE size, so the
// window is the 1024 m bounding square. That spends half its texels padding X,
// where there is no mesh; the baker clamps those from the mesh edge, which is what
// ClampToEdgeWrapping does at the border anyway.
//
// rgb, not grey, and not by preference: 138 m of relief over 8 bits is a 54 cm
// ladder, which terraces every hillside. The packed map costs four texture reads
// and a manual bilinear (see sampleHeight), and 2.9 MB instead of 272 KB.
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

// The control map is its OWN window, and a smaller one: control-512.png has paint
// for the 512 m region around the start, not for the full bounding square. Two
// different extents is fine — each carries its own origin/size uniforms — but
// outside this square the paint clamps, so the far terrain reads as bare ground.
const LEVEL_SIZE = 512
const LEVEL_ORIGIN: [number, number] = [-7.4813, 11.8386]

// How far vegetation reaches from the party leader, as a radius — the field is
// the square window of twice this around the focus. It sets draw distance AND
// density together, because the instance count is fixed: the same grid inside a
// smaller radius is a thicker lawn.
//
// 70 puts the edge fade exactly where the day preset's fog saturates, so the
// blades shrink away inside ground that has already dissolved into haze and the
// boundary can never be seen. Narrower and the ring shows on open ground; wider
// only pays for grass behind the fog.
//
// Flowers and tufts stay short on purpose: they are details you read up close,
// and their fade disappears into the grass long before the fog does.
const GRASS_RADIUS = 100
const SCATTER_RADIUS = 60

// useTexture's ref holds an empty Texture (image === null) until the file lands.
// Truthiness is not enough: handing a pixel-less texture to a WebGPU material
// throws inside the bind-group init every frame, which kills the render loop and
// leaves a blank page. Gate on the image, and only then let a material see it.
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
// The level GLB is authored in Blender and holds everything static: the terrain
// plus every non-interactable prop. The split here is by node name, because that
// is the only contract Blender can carry. Entities (anything with runtime state)
// never live in here — they come from YAML templates via the store.
const LEVEL_GROUND_NODE = 'Terrain'

const { state: gltf } = useGLTF('/levels/level-512.glb', {
  draco: true,
})
const propsRoot = shallowRef<Object3D | null>(null)
const canopyReferences = shallowRef<Object3D[]>([])
// Bruno's foliage SDF: one greyscale leaf silhouette the alpha test cuts out of every
// billboarded quad, so the leaf shape costs no geometry.
const { state: foliageTexture } = useTexture('/textures/foliage/foliageSDF.png')

const { state: grassDiffuseMap } = useTexture('/textures/grass/splat.jpg')
watch(grassDiffuseMap, (tex) => {
  if (tex) tex.colorSpace = SRGBColorSpace
}, { immediate: true })

watch(gltf, (loaded) => {
  if (!loaded) return

  const ground = loaded.scene.getObjectByName(LEVEL_GROUND_NODE)
  // fail loudly: a rename in Blender used to silently leave the authored terrain
  // in the scene, drawn on top of the generated one and z-fighting with it
  if (!(ground instanceof Mesh)) {
    console.error(`[terrain] no mesh named "${LEVEL_GROUND_NODE}" in the level GLB`)
    return
  }

  // The ground mesh itself is DROPPED: the height map is now the source of truth
  // and TerrainQuadtree generates the surface from it. This node is looked up
  // only so the loop below can leave it out.
  // Everything else is scenery. Clone rather than reparent: useGLTF caches the
  // scene by url, and moving nodes out of it would empty the cached copy on the
  // next HMR pass. Object3D.clone shares geometry and material, so this is cheap.
  const scenery = new Group()
  scenery.position.copy(loaded.scene.position)
  scenery.quaternion.copy(loaded.scene.quaternion)
  scenery.scale.copy(loaded.scene.scale)
  for (const child of loaded.scene.children) {
    if (child !== ground) scenery.add(child.clone())
  }

  // Canopies come out of the clone BEFORE propsRoot is published: the markers are
  // children of their trunk node, so the clone above brings them along, and the
  // grading watcher below would otherwise build node materials for three balls that
  // are about to be thrown away.
  canopyReferences.value = extractCanopyReferences(scenery)

  propsRoot.value = scenery
}, { immediate: true })

// The height map, straight off disk. Nothing is baked: the PNG IS the field, and
// the terrain mesh, the grass, the flowers and the props all read this one texture,
// so none of them can drift from the surface being drawn.
const { state: heightTexture } = useTexture(HEIGHT_MAP_URL)

watch(whenLoaded(heightTexture), (texture) => {
  if (!texture || heightField.value) return
  heightField.value = createHeightMap({ texture, meta: HEIGHT_META })
})

// --- Character, for scale and for walking the level ---

// Terrain height under a world XZ, or null before the map has loaded. Two array
// lookups and a bilinear blend, where this used to be a BVH raycast against 32k
// triangles: sampleHeightAt mirrors the shader's sampling exactly, so the ground
// the character stands on and the ground the GPU draws are the same surface.
function groundHeight(x: number, z: number): number | null {
  const field = heightField.value
  if (!field) return null
  const pixels = readHeightPixels(field)
  if (!pixels) return null
  return sampleHeightAt(field, pixels, x, z)
}

const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()
const playerId = shallowRef<string | null>(null)

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'))

onMounted(async () => {
  // Debug spawn: out in the duplicated half. The two halves meet at z = -244, so
  // this stands 268 m into the new one. y is ignored — the grounding pass below
  // raycasts the terrain every frame and overwrites it.
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
const grading = createGradingContext({ sceneNear: 50, sceneFar: 1000 })

watch(scene, (s) => {
  if (!s) return
  s.background = null                    // never leave a texture fighting the node
  s.backgroundNode = grading.fogColor    // sky IS the fog gradient
}, { immediate: true })

// Props are graded like every other model, but the contact-occlusion term needs
// the terrain height under each fragment: these rocks sit 4 to 6 metres below
// y = 0, and the default (ground at 0) would read that as buried and darken them.
watch([propsRoot, heightField], ([root, field]) => {
  if (!root || !field) return
  applyGradingToModel(root, grading, { groundHeight: sampleHeight(field, positionWorld.xz) })
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

// Terrain LOD. depth and split retune live; segments rebuilds the shared grid, so
// it remounts the component (the :key below) rather than pretending to be live.
//
// One vertex per texel on the FINEST node is the useful maximum; past it every
// extra vertex reads a texel twice. Here that is depth 6: 1024 / (32 * 2^6) = 0.5 m,
// the map's texel size. split is the radius a node splits inside, as a multiple of
// its own edge — 1.5 holds full detail out to ~24 m at this scale.
const { quadtreeSegments, quadtreeDepth, quadtreeSplit, quadtreeSkirt, quadtreeWireframe } = useControls('quadtree', {
  segments: { value: 32, min: 4, max: 64, step: 4, type: 'range' },
  depth: { value: 6, min: 0, max: 8, step: 1, type: 'range' },
  split: { value: 1.5, min: 0.5, max: 6, step: 0.1, type: 'range' },
  skirt: { value: 4, min: 0, max: 40, step: 0.25, type: 'range' },
  // every node draws the same number of quads, so cell size IS the LOD level:
  // small cells near the camera, big cells out at the edge
  wireframe: { value: false, type: 'boolean' },
}, { uuid })

// terrain look: one uniform bag, written into live. The material is built once
// (its node graph bakes in which maps exist), so every knob here has to be a
// uniform — anything else would need a rebuild.
const terrain = createTerrainUniforms()
const water = createWaterUniforms()

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

// Damp sand on the TERRAIN, not the water plane: the ring of darker ground that
// makes the waterline read as wet rather than as a decal edge. low/high is the
// painted blue band it ramps across; above/below are metres from the water line,
// so they decide how far up the beach the damp reaches and how far down it goes
// before the water's own absorption takes over the darkening.
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

// The water plane itself. `absorption` is the colour the water EATS, so the
// surface looks like its complement: reddish-orange absorption is what reads as
// blue-green water. strength is how hard that bites per metre, depth caps the
// ramp so sky pixels behind the plane don't go black, and edgeLow/edgeHigh is
// the painted blue band the surface fades in over.
//
// `level` drives BOTH the plane's Y and the terrain's idea of where the water
// line sits — they have to agree, or the damp ring detaches from the surface.
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

// Foam at the waterline. `depth` is the whole band in metres of water, so it
// widens on a gentle beach and tightens on a cliff without any painting; `edge`
// is the solid rim inside it; lines/width/drift are the stripes travelling
// toward the shore; `wobble` is how far the ripple normals push the band up and
// down the beach. `color` doubles as the strength: the mix goes all the way to
// it, so pulling it toward grey is exactly what a strength slider would do.
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

// World-aligned trample map: characters stamp it, grass and foliage read it and
// bend where it is marked. Size and origin match the control map and the height
// field, so one world XZ means the same texel in all three. 512 keeps the same
// ~8.5 texels per metre the 30m pages get at 256 — the cost is a 512² canvas
// re-uploaded on every fade frame, so drop the resolution first if this bites.
const trampleMap = createTrampleMap({ size: 60, resolution: 512 })

// Every scatter field rides this one centre, driven from the party leader below.
// The level is 512 x 1024 m and a fixed instance budget spread over that is a
// haze; spread over the window around the character it is a lawn. Bruno's trick:
// the fields wrap around the focus, so the same blade count follows the camera.
const scatterFocus = createScatterFocus()

// Radius is baked into the grid anchors, so moving it REBUILDS the geometry — the
// fields are keyed on it below. Debounced because a range fires on every pixel of
// a drag and rebuilding 270k blades per tick would stall it: the slider stays
// live, only the rebuild waits for you to let go. The fade is a uniform on the
// focus, so that one moves per frame.
const { scatterGrassRadius, scatterFlowerRadius, scatterFade } = useControls('scatter', {
  grassRadius: { value: GRASS_RADIUS, min: 20, max: 200, step: 5, type: 'range' },
  flowerRadius: { value: SCATTER_RADIUS, min: 10, max: 100, step: 5, type: 'range' },
  // where the edge fade starts, as a fraction of the radius. 1 = hard cut
  fade: { value: 0.85, min: 0.3, max: 1, step: 0.01, type: 'range' },
}, { uuid })

const grassRadius = refDebounced(scatterGrassRadius as Ref<number>, 250)
const flowerRadius = refDebounced(scatterFlowerRadius as Ref<number>, 250)

watch(scatterFade!, (value) => { scatterFocus.setFadeStart(value as number) })

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

// Canopies. Placement is authored in Blender (one icosphere per blob), so there is no
// density here — only the look. leafSize and amount are baked into the cluster geometry,
// so moving them rebuilds the instanced mesh; colours are uniforms and stay live.
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

// Also priority 10, for the same reason: stamping at the default priority would
// mark where the character stood last frame, leaving the trail a step behind.
// Trails first, then the live interactor — a stamp is the lasting mark that fades
// back, the interactor is where blades part around the character right now, so
// only the one being driven gets it.
onBeforeRender(({ delta }) => {
  trampleMap.update(delta)
  for (const entity of characterEntities.value) {
    const pos = getCharacterRef(entity.id)?.getPosition()
    if (pos) trampleMap.stamp(pos.x, pos.z)
  }
  const leaderPos = playerId.value ? getCharacterRef(playerId.value)?.getPosition() : null
  if (leaderPos) {
    trampleMap.setInteractor(leaderPos.x, leaderPos.z)
    // one write moves grass, tufts and all three flower species
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
  <!-- no ambient light: graded materials discard the lighting result, the sun is
       here only to drive the shadow map -->
  <TresDirectionalLight
    ref="directionalLightRef"
    :intensity="1.2"
    cast-shadow
  />
  <!-- The terrain, generated from the height map every frame. Every map has to be
       loaded before mount: the material bakes in which maps exist, so one arriving
       late would silently fall back to flat colour. -->
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
  <!-- Static scenery straight from the level GLB: rocks now, bridges and fences
       later. No pointer handler, so clicks fall through to the ground behind. -->
  <primitive
    v-if="propsRoot"
    :object="propsRoot"
  />
  <!-- The trunks render as ordinary scenery above; this only fills the canopy markers
       that extractCanopyReferences pulled out of that same GLB. -->
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
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
    :grading="grading"
  />
 <!-- 520² blades inside the default 70 m radius is ~14 per m². The same grid over
      the whole 512 m level was 0.3 per m², i.e. a haze. The window rides the party
      leader, and the splat still spans the LEVEL so its colour variation does not
      tile inside the window. Keyed on the radius: it is baked into the anchors. -->
 <Grass
    v-if="control && heightField && grassDiffuseMap"
    :key="grassRadius"
    :subdivisions="520"
    :diffuse-map="grassDiffuseMap"
    :diffuse-map-size="LEVEL_SIZE"
    :size="grassRadius * 2"
    :focus="scatterFocus"
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
