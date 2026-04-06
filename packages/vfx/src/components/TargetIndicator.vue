<script setup lang="ts">
import { watch } from 'vue'
import { Color, CylinderGeometry, DoubleSide } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { positionLocal, sin, time, smoothstep, mix, float, uniform } from 'three/tsl'

const props = withDefaults(defineProps<{
  position?: [number, number, number]
  radius?: number
  height?: number
  color?: string
  pulseSpeed?: number
  pulseMin?: number
  pulseMax?: number
}>(), {
  position: () => [0, 0, 0],
  radius: 0.5,
  height: 1.0,
  color: '#ffffff',
  pulseSpeed: 2.0,
  pulseMin: 0.3,
  pulseMax: 1.0,
})

// Cylinder geometry (radiusTop, radiusBottom, height, radialSegments)
const geometry = new CylinderGeometry(props.radius, props.radius, props.height, 32, 1, true)

// TSL Material with vertical gradient and animated pulse
const material = new MeshBasicNodeMaterial({
  transparent: true,
  side: DoubleSide,
  depthWrite: false, // Prevent Z-fighting with floor
})

// Node graph composition
// 1. Vertical gradient: bottom (y=-height/2) = opaque, top (y=+height/2) = transparent
const halfHeight = float(props.height / 2)
const normalizedY = positionLocal.y.add(halfHeight).div(props.height) // Map [-h/2, h/2] to [0, 1]
const gradientAlpha = float(1).sub(normalizedY) // 1 at bottom, 0 at top

// Smooth the gradient falloff
const smoothGradient = smoothstep(float(0.0), float(1.0), gradientAlpha)

// 2. Animated pulse using sine wave
const pulsePhase = time.mul(props.pulseSpeed)
const pulseWave = sin(pulsePhase) // Oscillates [-1, 1]
const normalizedPulse = pulseWave.mul(0.5).add(0.5) // Map to [0, 1]
const pulseIntensity = mix(float(props.pulseMin), float(props.pulseMax), normalizedPulse)

// 3. Combine gradient and pulse
const finalAlpha = smoothGradient.mul(pulseIntensity)

// 4. Apply color and opacity
const colorUniform = uniform(new Color(props.color))
material.colorNode = colorUniform
material.opacityNode = finalAlpha

// Update material when props change — mutate in-place, never replace the Color instance
watch(() => props.color, (newColor) => {
  colorUniform.value.set(new Color(newColor))
  material.needsUpdate = true
})

watch(() => props.pulseSpeed, () => {
  material.needsUpdate = true
})
</script>

<template>
  <TresMesh
    :position="position"
    :geometry="geometry"
    :material="material"
    :render-order="1"
  />
</template>
