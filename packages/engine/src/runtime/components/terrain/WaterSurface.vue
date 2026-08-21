<script setup lang="ts">
import { PlaneGeometry } from 'three'
import { color, mix, mx_noise_float, positionWorld, smoothstep, texture, uniform, vec4 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { useLoop } from '@tresjs/core'
import { controlUv } from '../../terrain/controlMap'
import type { ControlMap } from '../../terrain/controlMap'
import type { GradingContext } from '../../grading/grading'
import { stylizedOutput } from '../../grading/stylizedOutput'

const props = withDefaults(defineProps<{
  control: ControlMap
  level?: number
  shallow?: string
  deep?: string
  grading?: GradingContext | null
}>(), {
  level: -0.35,
  shallow: '#4f8f96',
  deep: '#1d4657',
})

const shallowColor = uniform(color(props.shallow))
const deepColor = uniform(color(props.deep))
const elapsed = uniform(0)

const geometry = new PlaneGeometry(props.control.size, props.control.size, 1, 1)
geometry.rotateX(-Math.PI / 2)

const material = new MeshBasicNodeMaterial()
material.transparent = true
// transparent water above opaque ground: never write depth, or it hides itself
material.depthWrite = false

const data = texture(props.control.texture, controlUv(props.control.uniforms, positionWorld.xz))
const depth = data.b

// two noise fields drifting in opposite directions read as moving ripples
const driftA = mx_noise_float(positionWorld.xz.mul(1.7).add(elapsed.mul(0.09)))
const driftB = mx_noise_float(positionWorld.xz.mul(2.9).sub(elapsed.mul(0.06)))
const ripple = driftA.add(driftB).mul(0.5).mul(0.5).add(0.5)

const tint = mix(shallowColor, deepColor, smoothstep(0.2, 0.85, depth))
const surface = mix(tint, tint.add(0.12), ripple)

// fades out over the shore, so the water edge is not a cut line
const alpha = smoothstep(0.04, 0.28, depth).mul(0.88)

// water is a flat plane, so a core shadow would tint the whole lake evenly —
// the finish is here for the fog, which is what dissolves the far shore
material.outputNode = props.grading
  ? stylizedOutput(surface, props.grading, { hasCoreShadows: false, alphaNode: alpha })
  : vec4(surface, alpha)

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  elapsed.value += delta
})
</script>

<template>
  <TresMesh
    name="water"
    :geometry="geometry"
    :material="material"
    :position-y="props.level"
  />
</template>
