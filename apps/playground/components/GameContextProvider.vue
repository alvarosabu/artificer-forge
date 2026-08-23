<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { MathUtils } from 'three'
import { Game } from '@artificer-forge/engine'
import { CAMERA_DEFAULTS, provideGameConfig } from '@artificer-forge/engine/runtime'
import type { CameraProps } from '@artificer-forge/engine/runtime'

// App-level context around the engine's <Game> host: positions the Leches debug GUI
// and feeds its tunable values into the engine via provideGameConfig().

const props = defineProps<{ camera?: CameraProps }>()

const { uuid } = useSharedLechesControls()

const config = provideGameConfig()

// Camera knobs. Seeded from the page's camera prop (falling back to the engine's
// own defaults) so the panel opens on whatever the scene authored instead of a
// second set of numbers. Polar limits are degrees here, radians in the props.
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

// Everything the panel does not own (position, target, lookAt, a follow target
// named by id) still comes from the page.
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

const { postprocessingBloomStrength, postprocessingBloomThreshold, postprocessingBloomRadius, postprocessingBloomSmoothWidth } = useControls('postprocessing', {
  bloomStrength: { value: config.bloom.strength, min: 0, max: 3, step: 0.01, type: 'range' },
  bloomRadius: { value: config.bloom.radius, min: 0, max: 1, step: 0.01, type: 'range' },
  bloomThreshold: { value: config.bloom.threshold, min: 0, max: 1, step: 0.01, type: 'range' },
  bloomSmoothWidth: { value: config.bloom.smoothWidth, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

// Keep the provided config in sync with the debug GUI.
watchEffect(() => {
  config.bloom.strength = toValue(postprocessingBloomStrength)
  config.bloom.radius = toValue(postprocessingBloomRadius)
  config.bloom.threshold = toValue(postprocessingBloomThreshold)
  config.bloom.smoothWidth = toValue(postprocessingBloomSmoothWidth)
})
</script>

<template>
  <slot name="controls" :uuid="uuid">
    <TresLeches :uuid="uuid" collapsed />
  </slot>
  <Game :camera="cameraProps">
    <!-- Only forward these when the page actually provides them, otherwise an
         empty slot would suppress Game's camera / systems / Hud defaults. -->
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
