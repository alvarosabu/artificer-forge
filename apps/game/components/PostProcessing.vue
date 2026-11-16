<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { EffectComposer } from '@artificer-forge/post-processing'
import type { BloomConfig, TiltShiftConfig } from '@artificer-forge/post-processing'
import { dayCyclePresets } from '~/utils/dayCyclePresets'
import type { DayCyclePreset } from '~/utils/dayCyclePresets'

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

const dayCycle = injectDayCycle()
const [dayPreset, duskPreset, nightPreset, dawnPreset] = dayCyclePresets as [DayCyclePreset, DayCyclePreset, DayCyclePreset, DayCyclePreset]

// Strength, radius and threshold blend with the day cycle. The day knobs also write dusk and dawn: only the night has its own bloom.
const {
  bloomEnabled,
  bloomDayStrength,
  bloomDayRadius,
  bloomDayThreshold,
  bloomNightStrength,
  bloomNightRadius,
  bloomNightThreshold,
  bloomSmoothWidth,
} = useControls('✨ bloom', {
  enabled: { value: true, type: 'boolean' },
  dayStrength: { value: dayPreset.bloomStrength, min: 0, max: 3, step: 0.01, type: 'range' },
  dayRadius: { value: dayPreset.bloomRadius, min: 0, max: 1, step: 0.01, type: 'range' },
  dayThreshold: { value: dayPreset.bloomThreshold, min: 0, max: 2, step: 0.01, type: 'range' },
  nightStrength: { value: nightPreset.bloomStrength, min: 0, max: 3, step: 0.01, type: 'range' },
  nightRadius: { value: nightPreset.bloomRadius, min: 0, max: 1, step: 0.01, type: 'range' },
  nightThreshold: { value: nightPreset.bloomThreshold, min: 0, max: 2, step: 0.01, type: 'range' },
  smoothWidth: { value: 1, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watchEffect(() => {
  for (const preset of [dayPreset, duskPreset, dawnPreset]) {
    preset.bloomStrength = bloomDayStrength!.value
    preset.bloomRadius = bloomDayRadius!.value
    preset.bloomThreshold = bloomDayThreshold!.value
  }
  nightPreset.bloomStrength = bloomNightStrength!.value
  nightPreset.bloomRadius = bloomNightRadius!.value
  nightPreset.bloomThreshold = bloomNightThreshold!.value
})

// The day cycle samples its presets every frame, so the bloom follows it here and not in a computed.
const bloom = shallowRef<BloomConfig | undefined>({
  strength: dayCycle.current.bloomStrength,
  radius: dayCycle.current.bloomRadius,
  threshold: dayCycle.current.bloomThreshold,
  smoothWidth: bloomSmoothWidth!.value,
})
const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  if (!bloomEnabled!.value) {
    bloom.value = undefined
    return
  }
  const { bloomStrength: strength, bloomRadius: radius, bloomThreshold: threshold } = dayCycle.current
  const smoothWidth = bloomSmoothWidth!.value
  const last = bloom.value
  if (last && last.strength === strength && last.radius === radius && last.threshold === threshold && last.smoothWidth === smoothWidth) return
  bloom.value = { strength, radius, threshold, smoothWidth }
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
