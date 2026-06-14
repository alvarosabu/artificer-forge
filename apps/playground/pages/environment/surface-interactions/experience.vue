<script setup lang="ts">
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, color, cos, dot, float, max, mix, mul, mx_fractal_noise_float, normalView,
  positionViewDirection, positionWorld, smoothstep, texture as textureNode, time, uv, vec2, vec3,
} from 'three/tsl'
import { DataTexture, FloatType, LinearFilter, Mesh, PlaneGeometry, RGBAFormat, SRGBColorSpace } from 'three'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'
import { Floor } from '@artificer-forge/components/tres'
import { useLoop } from '@tresjs/core'
import { useSceneRefs } from '@artificer-forge/composables'
import { buildCharcoalSurfaceMaterial, buildFireSurfaceMaterial, createFireBillboards, createInstancedEmberSystem } from '@artificer-forge/vfx'
import { createSurfaceGrid } from '~/utils/surfaces/grid'
import type { SurfaceKind } from '~/utils/surfaces/types'
import { step } from '~/utils/surfaces/sim'
import { packCells, packFire } from '~/utils/surfaces/texture'
import { statusForCell } from '~/utils/surfaces/matrix'

// --- grid config ---
const COLS = 32
const ROWS = 32
const CELL = 0.5
const WIDTH = COLS * CELL // 16m
const DEPTH = ROWS * CELL

const grid = createSurfaceGrid(COLS, ROWS, CELL)

// Pre-placed pools: stamped at full radius with infinite lifetime — no growth,
// no decay (decay skips non-finite lifetimes), so the field stays put while
// you walk through it. seed() would give growing-then-fading pools instead.
function placePool(x: number, z: number, kind: SurfaceKind, radius: number) {
  const { col, row } = grid.worldToCell(x, z)
  grid.stampDisc(col, row, kind, radius, 1, Number.POSITIVE_INFINITY)
}
placePool(-4, -4, 'water', 4)
placePool(4, -4, 'oil', 3)
placePool(-4, 4, 'poison', 3)
placePool(4, 4, 'blood', 3)
placePool(5, 0, 'fire', 3)

const data = new Float32Array(COLS * ROWS * 4)
const texture = new DataTexture(data, COLS, ROWS, RGBAFormat, FloatType)
texture.minFilter = LinearFilter // bilinear smoothing between cells — de-blocks the grid
texture.magFilter = LinearFilter
texture.needsUpdate = true

const fireData = new Float32Array(COLS * ROWS * 4)
const fireTexture = new DataTexture(fireData, COLS, ROWS, RGBAFormat, FloatType)
fireTexture.minFilter = LinearFilter
fireTexture.magFilter = LinearFilter
fireTexture.needsUpdate = true

// Same material as /environment/surface — second copy is the cue to extract
// SurfaceField.vue (roadmap: fire milestone).
// Pools only (water/oil/poison/blood). Fire/charcoal moved to its own displaced
// mesh — buildCharcoalSurfaceMaterial — because real charcoal needs vertical
// relief this flat 1-segment plane can't provide.
function buildMaterial(tex: DataTexture): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false // transparent overlay — writing depth here occludes the fire billboards when draw order flips on orbit
  mat.roughness = 0.9

  const fieldUv = vec2(uv().x, uv().y.oneMinus()) // keep the spike's V flip — it's load-bearing
  const amount = textureNode(tex, fieldUv)
  const water = amount.r
  const oil = amount.g
  const poison = amount.b
  const blood = amount.a

  // Slow-drifting noise breaks pool edges so they read organic, not disc-shaped.
  const edgeNoise = mx_fractal_noise_float(
    add(mul(positionWorld.xz, 1.8), time.mul(0.05)),
    3, 2.0, 0.5,
  ).mul(0.5).add(0.5)

  const maskOf = (amount: ReturnType<typeof float>) =>
    smoothstep(float(0.15), float(0.6), amount.mul(edgeNoise.mul(0.6).add(0.7)))

  const waterMask = maskOf(water)
  const oilMask = maskOf(oil)
  const poisonMask = maskOf(poison)
  const bloodMask = maskOf(blood)

  const waterCol = mix(color('#0c3b66'), color('#2f7fd0'), edgeNoise)

  // Fake thin-film iridescence: a cosine rainbow palette phased by view angle
  // + the shared noise. Real iridescence is specular-driven and needs env
  // reflections — under flat ambient light this cheat reads better.
  const facing = dot(normalView, positionViewDirection).saturate()
  const filmPhase = edgeNoise.mul(2.5).add(facing.mul(1.5)).add(time.mul(0.06))
  const rainbow = vec3(
    cos(filmPhase.mul(Math.PI * 2)),
    cos(filmPhase.mul(Math.PI * 2).sub(2.094)), // ±120° per channel = hue wheel
    cos(filmPhase.mul(Math.PI * 2).sub(4.188)),
  ).mul(0.5).add(0.5)
  const sheen = smoothstep(float(0.35), float(0.8), edgeNoise).mul(0.55) // patchy, like a real slick
  const oilCol = mix(mix(color('#14100c'), color('#3a2f1c'), edgeNoise), rainbow, sheen)
  const poisonCol = mix(color('#176022'), color('#37d24a'), edgeNoise)
  const bloodCol = mix(color('#3d060a'), color('#6e0f14'), edgeNoise)

  // Only one kind occupies a cell — overlap only exists in the bilinear blend
  // zone between pools, where later layers win.
  const base = color('#0e1118')
  let col = mix(base, waterCol, waterMask)
  col = mix(col, oilCol, oilMask)
  col = mix(col, poisonCol, poisonMask)
  col = mix(col, bloodCol, bloodMask)

  // Per-kind opacity — kinds are exclusive per cell, so max() picks whichever
  // is active (seams briefly blend both, which reads fine).
  const opacity = max(
    waterMask.mul(0.15), // water: see the ground through it
    max(oilMask.mul(0.95), max(poisonMask.mul(0.85), bloodMask.mul(0.9))),
  )

  mat.colorNode = col
  mat.opacityNode = opacity
  return mat
}

const material = buildMaterial(texture)

// Charcoal bed — a subdivided plane the material actually displaces upward, so
// the lumps have real silhouette + catch light (a flat plane + bump never could).
// 160² segments over the field ≈ 0.1m quads — fine detail for the ~0.5m humps.
// Must sit at XZ origin: the material samples positionWorld.xz/positionLocal.xz.
const charcoalMaterial = buildCharcoalSurfaceMaterial(fireTexture)
const charcoalGeo = new PlaneGeometry(WIDTH, DEPTH, 160, 160)
charcoalGeo.rotateX(-Math.PI / 2)
const charcoalMesh = new Mesh(charcoalGeo, charcoalMaterial)
charcoalMesh.position.set(0, 0.012, 0)

const fireMaterial = buildFireSurfaceMaterial(fireTexture)
const fireGeo = new PlaneGeometry(WIDTH, DEPTH)
fireGeo.rotateX(-Math.PI / 2)
const fireMesh = new Mesh(fireGeo, fireMaterial)
fireMesh.position.set(0, 0.02, 0)

const { mesh: emberMesh } = createInstancedEmberSystem(WIDTH, DEPTH, fireTexture)

const flipbookTex = await new TGALoader().loadAsync('/textures/flipbook/flame03/Flame03_16x4.tga')
flipbookTex.colorSpace = SRGBColorSpace

const { mesh: flameBillboards } = createFireBillboards(WIDTH, DEPTH, fireTexture, 60, 1.5, flipbookTex)
flameBillboards.position.set(5, 0, 0)

const { onBeforeRender } = useLoop()

// Sim still runs (fire contagion / electrified decay later); the infinite
// lifetimes just exempt the pre-placed pools from fading.
onBeforeRender(({ delta }) => {
  step(grid, Math.min(delta, 0.1))
  packCells(grid.cells, data)
  packFire(grid.cells, fireData)
  texture.needsUpdate = true
  fireTexture.needsUpdate = true

  // Statuses persist after leaving the surface — no removal here until the
  // tick/duration system exists to expire them.
  for (const entity of gameStore.entities.values()) {
    if (entity.type !== 'character') continue
    const cell = grid.sample(entity.position.x, entity.position.z)
    const status = statusForCell(cell)
    if (status) {
      gameStore.addStatusEffect(entity.id, status) // dedupes — safe every frame
    }
  }
})

// --- character (same pattern as combat/attack) ---
const gameStore = useGameStore()
const { setCharacterRef } = useSceneRefs()
const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands()

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  registerEntities()
})

onUnmounted(() => {
  unregisterEntities()
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />

  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Floor />
  <!-- No pointer handlers on purpose: Tres's event system only intersects
       objects with listeners, so clicks fall through to CombatSystem's
       invisible plane (click-to-move). Adding @click here would block it. -->
  <TresMesh
    name="surface-map"
    :material="material"
    :position="[0, 0.01, 0]"
  >
    <TresPlaneGeometry :args="[WIDTH, DEPTH]" :rotate-x="-Math.PI / 2" />
  </TresMesh>
  <primitive :object="charcoalMesh" />
  <primitive :object="fireMesh" />
  <primitive :object="flameBillboards" />
  <primitive :object="emberMesh" />
</template>
