<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { EffectComposer } from '@artificer-forge/post-processing'
import type { BloomConfig, TiltShiftConfig } from '@artificer-forge/post-processing'

const uuid = inject<string>('uuid')

const {
  tiltShiftEnabled,
  tiltShiftFocusCenter,
  tiltShiftBandWidth,
  tiltShiftFeather,
  tiltShiftStrength,
  tiltShiftFocalRange,
  tiltShiftFocusHeight,
  tiltShiftSmoothing,
  tiltShiftSigma,
  tiltShiftResolutionScale,
} = useControls('🔍 tiltShift', {
  enabled: { value: true, type: 'boolean' },
  focusCenter: { value: 0.53, min: 0, max: 1, step: 0.01, type: 'range' },
  bandWidth: { value: 0.1, min: 0, max: 0.5, step: 0.01, type: 'range' },
  feather: { value: 0.35, min: 0.01, max: 1, step: 0.01, type: 'range' },
  strength: { value: 0.5, min: 0, max: 4, step: 0.05, type: 'range' },
  focalRange: { value: 12, min: 0.5, max: 50, step: 0.5, type: 'range' },
  focusHeight: { value: 1, min: 0, max: 3, step: 0.05, type: 'range' },
  smoothing: { value: 8, min: 0.5, max: 30, step: 0.5, type: 'range' },
  // Baked into the shader: every change rebuilds the pipeline.
  sigma: { value: 8, min: 1, max: 16, step: 1, type: 'range' },
  resolutionScale: { value: 0.5, min: 0.125, max: 1, step: 0.125, type: 'range' },
}, { uuid })

// Threshold 1: only HDR emissives (torch glow) bloom, the graded world stays at or below 1.
const { bloomEnabled, bloomStrength, bloomRadius, bloomThreshold, bloomSmoothWidth } = useControls('✨ bloom', {
  enabled: { value: true, type: 'boolean' },
  strength: { value: 0.25, min: 0, max: 3, step: 0.01, type: 'range' },
  radius: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
  threshold: { value: 1, min: 0, max: 2, step: 0.01, type: 'range' },
  smoothWidth: { value: 1, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

const bloom = computed<BloomConfig | undefined>(() => {
  if (!bloomEnabled?.value) return undefined
  return {
    strength: bloomStrength?.value,
    radius: bloomRadius?.value,
    threshold: bloomThreshold?.value,
    smoothWidth: bloomSmoothWidth?.value,
  }
})

const tiltShift = computed<TiltShiftConfig | undefined>(() => {
  if (!tiltShiftEnabled?.value) return undefined
  return {
    focusCenter: tiltShiftFocusCenter?.value,
    bandWidth: tiltShiftBandWidth?.value,
    feather: tiltShiftFeather?.value,
    strength: tiltShiftStrength?.value,
    focalRange: tiltShiftFocalRange?.value,
    focusDistance: 15,
    focusHeight: tiltShiftFocusHeight?.value,
    smoothing: tiltShiftSmoothing?.value,
    sigma: tiltShiftSigma?.value,
    resolutionScale: tiltShiftResolutionScale?.value,
  }
})
</script>

<template>
  <EffectComposer
    :bloom="bloom"
    :tilt-shift="tiltShift"
  />
</template>
