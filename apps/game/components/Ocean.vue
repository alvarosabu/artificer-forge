<script setup lang="ts">
import { color, float, mix, mx_noise_float, mx_worley_noise_float, parallaxUV, time, uv, vec3, vec4 } from 'three/tsl'
import { PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'

// Place it with `position` on the component: the attribute falls through to the mesh.
const props = defineProps<{
  /** Side of the square plane, in metres */
  size: number
}>()

// The shader was tuned on a 4 m wide disc. Scale uv to that tile so caustics
// and foam keep their size in metres, whatever the plane size.
const TILE = 4

const geometry = new PlaneGeometry(props.size, props.size, 1, 1)
geometry.rotateX(-Math.PI / 2)

const tiledUv = uv().mul(props.size / TILE)

// @types/three types parallaxUV as an untyped Node.
const depthUv = (parallaxUV(tiledUv, float(0.5)) as ReturnType<typeof uv>).xy
const causticsUv = vec3(depthUv.mul(6), time.mul(0.3))
const causticsNoise = mx_worley_noise_float(causticsUv).pow3()
const depthColor = mix(color(0x1B3956), color(0x11EEFF), causticsNoise)

const foamUv = vec3(tiledUv.mul(5), time.mul(0.1))
const foamMask = mx_noise_float(foamUv).abs().step(0.05).oneMinus()
const foamColor = color(0xE5F7FF)

// Fade to transparent at the plane edge, so it has no hard border against the sky.
const edgeFade = uv().sub(0.5).length().smoothstep(0.5, 0.2)

const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
material.outputNode = vec4(mix(depthColor, foamColor, foamMask), edgeFade)
</script>

<template>
  <TresMesh
    name="ocean"
    :geometry="geometry"
    :material="material"
  />
</template>
