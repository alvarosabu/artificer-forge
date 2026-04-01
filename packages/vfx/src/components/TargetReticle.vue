<script setup lang="ts">
import { Color, DoubleSide, PlaneGeometry, Vector3Like } from 'three';
import { color, float, uniform, uv, length, abs, smoothstep, sin, time, cos, Fn, max, mix, step } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { toRefs } from 'vue';


interface ReticleProps {
    position: [number, number, number]
    color: string
    radius: number
    visible: boolean
}

const props = withDefaults(defineProps<ReticleProps>(), {
    position: () => [0, 0.01, 0],
    color: '#ffffff',
    radius: 0.8,
    visible: true,
})

const { radius, color: colorProp} = toRefs(props)

const geometry = new PlaneGeometry(radius.value * 2.5, radius.value * 2.5)


const uRadius = uniform(float(radius.value))
const uColor = uniform(color(colorProp.value))

const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
})

// Remap UV [0,1] -> [-1,1] centered; scale by 1.25 to match plane half-width
// so the ring sits at world-radius r and isn't clipped at the plane edges
const centeredUV = uv().mul(2.0).sub(1.0).mul(uRadius.mul(1.25))

// Circle border SDF
const borderWidth = uRadius.mul(0.08)       // 8% of radius
const arrowWidth  = borderWidth.mul(2.0)    // 2x border for triangles

const dist = length(centeredUV)
const circleSdf = abs(dist.sub(uRadius)).sub(borderWidth.mul(0.5))

const onCircle = smoothstep(float(0.01), float(0.0), circleSdf)

// 8 inward triangles (one per 45 degrees)
// For each triangle i:
//   Rotate UV by -i*PI/4
//   In rotated frame: tip at (uRadius, 0), base on circle band
//   Triangle is isoceles: half-width arrowWidth/2, depth = borderWidth*2
//
// We compute the union of all 8 triangles using TSL Fn
const trianglesMask = Fn(() => {
  const mask = float(0).toVar()
  const COUNT = 8
  for (let i = 0; i < COUNT; i++) {
    const angle = float((i * Math.PI * 2) / COUNT)
    const cosA = cos(angle)
    const sinA = sin(angle)
    // Rotate centeredUV into triangle's local space
    const rx = centeredUV.x.mul(cosA).add(centeredUV.y.mul(sinA))
    const ry = centeredUV.x.mul(sinA.negate()).add(centeredUV.y.mul(cosA))
    // Triangle base sits at inner edge of ring; tip extends inward toward center
    // This keeps the triangles in the transparent interior so they're visible
    const baseX   = uRadius.sub(borderWidth.mul(0.5))   // at inner edge of ring
    const tipX    = baseX.sub(arrowWidth)                // extends inward
    const halfBase = arrowWidth.mul(0.5)
    // Parametric: at baseX, half-width is halfBase; at tipX, half-width is 0
    // t = (rx - tipX) / (baseX - tipX) => linear interp of width
    const depth = baseX.sub(tipX)
    const t = rx.sub(tipX).div(depth)
    const allowedHalfWidth = mix(float(0.0), halfBase, t)
    const inTriangle = step(tipX, rx).mul(step(rx, baseX)).mul(step(abs(ry), allowedHalfWidth))
    mask.assign(max(mask, inTriangle))
  }
  return mask
})()

const combined = max(onCircle, trianglesMask)
const pulse = sin(time.mul(2.5)).mul(0.25).add(0.75) // oscillates 0.5 to 1.0
const finalAlpha = combined.mul(pulse)

material.colorNode = uColor
material.opacityNode = finalAlpha

</script>

<template>
    <TresMesh
        :geometry="geometry"
        :position="position"
        :rotation-x="-Math.PI / 2"
        :material="material"
        :visible="visible"
    />
</template>