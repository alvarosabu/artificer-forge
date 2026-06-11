<script setup lang="ts">
import { PlaneGeometry } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, color, cos, dot, float, max, mix, mul, mx_fractal_noise_float, normalView,
  positionViewDirection, positionWorld, smoothstep, texture as textureNode, time, uv, vec2, vec3,
} from 'three/tsl'
import { OrbitControls } from '@tresjs/cientos'
import { DataTexture, FloatType, LinearFilter, RGBAFormat } from 'three'
import { Floor } from '@artificer-forge/components/tres'
import type { TresPointerEvent } from '@tresjs/core'
import { useLoop } from '@tresjs/core'
import { createSurfaceGrid } from '~/utils/surfaces/grid'
import type { SurfaceKind } from '~/utils/surfaces/types'
import { step } from '~/utils/surfaces/sim'
import { packCells } from '~/utils/surfaces/texture'

const uuid = inject('unique-uuid')

const { surfaceKind } = useControls('surface', {
  kind: {
    value: 'water' as SurfaceKind,
    options: [
      { text: '💧 Water', value: 'water' },
      { text: '☠️ Poison', value: 'poison' },
      { text: '🩸 Blood', value: 'blood' },
      { text: '🛢️ Oil', value: 'oil'}
    ],
  },
}, { uuid })

// --- grid config ---
const COLS = 32
const ROWS = 32
const CELL = 0.5
const WIDTH = COLS * CELL // 16m
const DEPTH = ROWS * CELL

// The grid is the source of truth now. Its default origin is centred on the
// world origin — same as the spike's ORIGIN_X/Z, so the texture mapping holds.
const grid = createSurfaceGrid(COLS, ROWS, CELL)

const data = new Float32Array(COLS * ROWS * 4)
const texture = new DataTexture(data, COLS, ROWS, RGBAFormat, FloatType)
texture.minFilter = LinearFilter // bilinear smoothing between cells — de-blocks the grid
texture.magFilter = LinearFilter
texture.needsUpdate = true

function buildMaterial(tex: DataTexture): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
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

const { onBeforeRender } = useLoop()

// The sim replaces the spike's manual fade loop: grow sources, run decay,
// then project the cells into the texture.
onBeforeRender(({ delta }) => {
  step(grid, Math.min(delta, 0.1))
  packCells(grid.cells, data)
  texture.needsUpdate = true
})

// Seeding the grid replaces painting the texture directly.
function onPaint(e: TresPointerEvent) {
  if (!e.point) return
  grid.seed(e.point.x, e.point.z, surfaceKind.value)
}
</script>

<template>
  <TresPerspectiveCamera :position="[8, 6, 8]" :look-at="[0, 0, 0]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  
  <Floor />
  <TresMesh name="surface-map" @click="onPaint" :material="material" :position="[0, 0.01, 0]">
   <TresPlaneGeometry :args="[WIDTH, DEPTH]" :rotate-x="-Math.PI / 2" />
  </TresMesh>
</template>
