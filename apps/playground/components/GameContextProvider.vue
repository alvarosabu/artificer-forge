<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { MathUtils } from 'three'
import { Game } from '@artificer-forge/engine'
import { CAMERA_DEFAULTS, provideGameConfig } from '@artificer-forge/engine/runtime'
import type { CameraProps } from '@artificer-forge/engine/runtime'

const props = defineProps<{ camera?: CameraProps }>()

const { uuid } = useSharedLechesControls()

const config = provideGameConfig()

// Seeded from the page's camera so the panel opens on the scene's own values.
// Polar limits are degrees here, radians in the props.
const seed = { ...CAMERA_DEFAULTS, ...props.camera }

const { cameraFov, cameraNear, cameraFar, cameraMinDistance, cameraMaxDistance, cameraMinPolar, cameraMaxPolar, cameraFollow, cameraFollowHeight, cameraFollowSmoothing, cameraOrbit } = useControls('camera', {
  fov: { value: seed.fov, min: 10, max: 120, step: 1, type: 'range' },
  near: { value: seed.near, min: 0.01, max: 10, step: 0.01, type: 'range' },
  far: { value: seed.far, min: 10, max: 3000, step: 10, type: 'range' },
  minDistance: { value: seed.minDistance, min: 0, max: 200, step: 0.1, type: 'range' },
  maxDistance: { value: seed.maxDistance, min: 0, max: 500, step: 0.5, type: 'range' },
  minPolar: { value: MathUtils.radToDeg(seed.minPolarAngle), min: 0, max: 180, step: 1, type: 'range' },
  maxPolar: { value: MathUtils.radToDeg(seed.maxPolarAngle), min: 0, max: 180, step: 1, type: 'range' },
  follow: { value: Boolean(seed.follow), type: 'boolean' },
  followHeight: { value: seed.followHeight, min: -5, max: 20, step: 0.1, type: 'range' },
  followSmoothing: { value: seed.followSmoothing, min: 0.1, max: 30, step: 0.1, type: 'range' },
  orbit: { value: seed.controls, type: 'boolean' },
}, { uuid })

const cameraProps = computed<CameraProps>(() => ({
  ...props.camera,
  fov: toValue(cameraFov),
  near: toValue(cameraNear),
  far: toValue(cameraFar),
  minDistance: toValue(cameraMinDistance),
  maxDistance: toValue(cameraMaxDistance),
  minPolarAngle: MathUtils.degToRad(toValue(cameraMinPolar)),
  maxPolarAngle: MathUtils.degToRad(toValue(cameraMaxPolar)),
  // a string follow target is a party member id: keep it, the toggle only gates it
  follow: toValue(cameraFollow) ? (typeof props.camera?.follow === 'string' ? props.camera.follow : true) : false,
  followHeight: toValue(cameraFollowHeight),
  followSmoothing: toValue(cameraFollowSmoothing),
  controls: toValue(cameraOrbit),
}))

const { postprocessingBloomStrength, postprocessingBloomThreshold, postprocessingBloomRadius, postprocessingBloomSmoothWidth, postprocessingBloomResolutionScale } = useControls('postprocessing', {
  bloomStrength: { value: config.bloom.strength, min: 0, max: 3, step: 0.01, type: 'range' },
  bloomRadius: { value: config.bloom.radius, min: 0, max: 1, step: 0.01, type: 'range' },
  bloomThreshold: { value: config.bloom.threshold, min: 0, max: 1, step: 0.01, type: 'range' },
  bloomSmoothWidth: { value: config.bloom.smoothWidth, min: 0, max: 1, step: 0.01, type: 'range' },
  bloomResolutionScale: { value: config.bloom.resolutionScale, min: 0.1, max: 1, step: 0.05, type: 'range' },
}, { uuid })

const { dofEnabled, dofFocalLength, dofBokehScale, dofFocusDistance, dofFocusHeight, dofSmoothing, dofResolutionScale } = useControls('dof', {
  enabled: { value: config.dof.enabled, type: 'boolean' },
  focalLength: { value: config.dof.focalLength, min: 0.1, max: 120, step: 0.1, type: 'range' },
  bokehScale: { value: config.dof.bokehScale, min: 0, max: 10, step: 0.1, type: 'range' },
  focusDistance: { value: config.dof.focusDistance, min: 0, max: 200, step: 0.5, type: 'range' },
  focusHeight: { value: config.dof.focusHeight, min: -2, max: 5, step: 0.1, type: 'range' },
  smoothing: { value: config.dof.smoothing, min: 0.5, max: 30, step: 0.5, type: 'range' },
  resolutionScale: { value: config.dof.resolutionScale, min: 0.1, max: 1, step: 0.05, type: 'range' },
}, { uuid })

const { tiltshiftEnabled, tiltshiftFocusCenter, tiltshiftBandWidth, tiltshiftFeather, tiltshiftStrength, tiltshiftFocalRange, tiltshiftFocusDistance, tiltshiftFocusHeight, tiltshiftSmoothing, tiltshiftSigma, tiltshiftResolutionScale } = useControls('tiltshift', {
  enabled: { value: config.tiltShift.enabled, type: 'boolean' },
  focusCenter: { value: config.tiltShift.focusCenter, min: 0, max: 1, step: 0.01, type: 'range' },
  bandWidth: { value: config.tiltShift.bandWidth, min: 0, max: 0.5, step: 0.01, type: 'range' },
  feather: { value: config.tiltShift.feather, min: 0.01, max: 1, step: 0.01, type: 'range' },
  strength: { value: config.tiltShift.strength, min: 0, max: 4, step: 0.05, type: 'range' },
  focalRange: { value: config.tiltShift.focalRange, min: 0, max: 100, step: 0.5, type: 'range' },
  focusDistance: { value: config.tiltShift.focusDistance, min: 0, max: 200, step: 0.5, type: 'range' },
  focusHeight: { value: config.tiltShift.focusHeight, min: -2, max: 5, step: 0.1, type: 'range' },
  smoothing: { value: config.tiltShift.smoothing, min: 0.5, max: 30, step: 0.5, type: 'range' },
  sigma: { value: config.tiltShift.sigma, min: 2, max: 20, step: 1, type: 'range' },
  resolutionScale: { value: config.tiltShift.resolutionScale, min: 0.1, max: 1, step: 0.05, type: 'range' },
}, { uuid })

watchEffect(() => {
  config.bloom.strength = toValue(postprocessingBloomStrength)
  config.bloom.radius = toValue(postprocessingBloomRadius)
  config.bloom.threshold = toValue(postprocessingBloomThreshold)
  config.bloom.smoothWidth = toValue(postprocessingBloomSmoothWidth)
  config.bloom.resolutionScale = toValue(postprocessingBloomResolutionScale)
  config.dof.enabled = toValue(dofEnabled)
  config.dof.focalLength = toValue(dofFocalLength)
  config.dof.bokehScale = toValue(dofBokehScale)
  config.dof.focusDistance = toValue(dofFocusDistance)
  config.dof.focusHeight = toValue(dofFocusHeight)
  config.dof.smoothing = toValue(dofSmoothing)
  config.dof.resolutionScale = toValue(dofResolutionScale)
  config.tiltShift.enabled = toValue(tiltshiftEnabled)
  config.tiltShift.focusCenter = toValue(tiltshiftFocusCenter)
  config.tiltShift.bandWidth = toValue(tiltshiftBandWidth)
  config.tiltShift.feather = toValue(tiltshiftFeather)
  config.tiltShift.strength = toValue(tiltshiftStrength)
  config.tiltShift.focalRange = toValue(tiltshiftFocalRange)
  config.tiltShift.focusDistance = toValue(tiltshiftFocusDistance)
  config.tiltShift.focusHeight = toValue(tiltshiftFocusHeight)
  config.tiltShift.smoothing = toValue(tiltshiftSmoothing)
  config.tiltShift.sigma = toValue(tiltshiftSigma)
  config.tiltShift.resolutionScale = toValue(tiltshiftResolutionScale)
})
</script>

<template>
  <slot name="controls" :uuid="uuid">
    <TresLeches :uuid="uuid" collapsed />
  </slot>
  <Game :camera="cameraProps">
    <!-- Forward only when the page provides them: an empty slot would suppress
         Game's camera / systems / hud defaults. -->
    <template v-if="$slots.camera" #camera>
      <slot name="camera" />
    </template>
    <template v-if="$slots.systems" #systems>
      <slot name="systems" />
    </template>
    <template v-if="$slots.hud" #hud>
      <slot name="hud" />
    </template>
    <slot />
  </Game>
</template>
