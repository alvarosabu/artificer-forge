<script setup lang="ts">
import { DoubleSide, PlaneGeometry, Vector3 } from 'three'
import { MeshLambertNodeMaterial, NodeMaterial, Node } from 'three/webgpu'
import {
  clamp,
  smoothstep,
  color,
  Fn,
  uniform,
  vec4,
  uv,
  mix,
  step,
  positionWorld,
  vec3,
} from 'three/tsl'
import { TresPointerEvent } from '@tresjs/core'
import type { GradingContext } from '../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../grading/stylizedOutput'

interface GridLine {
  color: Node<'color'>
  scale: Node<'float'>
  thickness: Node<'float'>
  cross: Node<'float'>
}

const props = defineProps<{ grading?: GradingContext | null }>()

const emit = defineEmits<{
  click: [event: TresPointerEvent]
}>()

function handleClick(event: TresPointerEvent) {
  emit('click', event)
}

function createGridLine(
  lineColor: string | number = 0xffffff,
  scale = 1,
  thickness = 0.05,
  cross = 1,
): GridLine {
  return {
    color: uniform(color(lineColor)),
    scale: uniform(scale),
    thickness: uniform(thickness),
    cross: uniform(cross),
  }
}

// Antialiased grid based on https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
const toAntialiasedGrid = Fn(([uvRef, scale, thickness, cross]: [any, any, any, any]) => {
  const lineWidth = thickness
  const referenceUv = uvRef.div(scale)
  const uvDeriv = referenceUv.fwidth()
  const drawWidth = clamp(lineWidth, uvDeriv, 1)
  const lineAA = uvDeriv.mul(1.5)

  // Cross mask - creates the + pattern by masking out parts of the grid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crossGrid: any = step(referenceUv.fract().sub(0.5).abs(), cross.oneMinus().mul(0.5))
  const crossMask = mix(crossGrid.x, 1, crossGrid.y).oneMinus()

  const gridUV = referenceUv.fract().mul(2).sub(1).abs().oneMinus()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let grid: any = smoothstep(drawWidth.add(lineAA), drawWidth.sub(lineAA), gridUV)
  grid = grid.mul(clamp(lineWidth.div(drawWidth), 0, 1))
  grid = mix(grid, lineWidth, clamp(uvDeriv.mul(2).sub(1), 0, 1)).mul(crossMask)

  return mix(grid.x, 1, grid.y)
})

function createGridMaterial(
  baseColor: string | number,
  lines: GridLine[],
  globalScale = 1,
  grading: GradingContext | null = null,
  fadeStart = 40,
  fadeEnd = 80,
) {
  // graded floor is the main drop-shadow receiver — Lambert base so the catcher runs
  const material = grading ? new MeshLambertNodeMaterial() : new NodeMaterial()
  material.side = DoubleSide

  const scaleNode = uniform(globalScale)
  const fadeStartNode = uniform(fadeStart)
  const fadeEndNode = uniform(fadeEnd)

  // Build color by layering grids - use reduce to maintain proper typing
  const gridColor = lines.reduce<Node<'vec3'>>(
    (acc, line) => {
      const grid = toAntialiasedGrid(
        uv(),
        line.scale.mul(scaleNode),
        line.thickness,
        line.cross,
      )
      return mix(acc, vec3(line.color), grid)
    },
    vec3(uniform(color(baseColor))),
  )

  material.colorNode = gridColor

  if (grading) {
    // fog does the horizon dissolve now — no hand-rolled distance fade, no
    // hardcoded clear-color assumption on this path
    material.transparent = false
    material.depthWrite = true
    const dropShadow = createDropShadowCatcher()
    material.receivedShadowNode = dropShadow.receivedShadowNode
    material.outputNode = stylizedOutput(gridColor, grading, { hasCoreShadows: false, dropShadowNode: dropShadow.shadowFactor })
  }
  else {
    material.transparent = true
    material.depthWrite = false // transparent ground: writing depth lets it occlude transparent objects above it (e.g. fire billboards) depending on draw order
    // Distance-based fade for horizon effect, from world position to origin (XZ plane)
    const dist = positionWorld.xz.length()
    const fadeAlpha = smoothstep(fadeEndNode, fadeStartNode, dist)
    material.outputNode = vec4(gridColor, fadeAlpha)
  }

  return { material, scaleNode, fadeStartNode, fadeEndNode }
}

// Configure grid lines - matching Bruno Simon's folio style
// Small purple crosses + faint larger grid
const lines: GridLine[] = [
  createGridLine('#4444ff', 0.05, 0.015, 0.15), // blue crosses, cross=0.15 makes + shape
  createGridLine('#332255', 0.1, 0.002, 2), // faint larger grid lines
]

// Base color matches TresCanvas clear-color for seamless horizon fade
const { material } = createGridMaterial(0x020420, lines, 0.1, props.grading)

const geometry = new PlaneGeometry(200, 200)
</script>

<template>
  <TresMesh
    name="floor"
    :geometry="geometry"
    :material="material"
    :rotation-x="-Math.PI / 2"
    receive-shadow
    @click="handleClick"
  />
</template>
