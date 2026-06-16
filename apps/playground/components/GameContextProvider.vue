<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { Game } from '@artificer-forge/engine/ui'
import { provideGameConfig } from '@artificer-forge/engine/runtime'

// App-level context around the engine's <Game> host: positions the Leches debug GUI
// and feeds its tunable values into the engine via provideGameConfig().

interface CameraProps {
  position?: [number, number, number]
  lookAt?: [number, number, number]
  target?: [number, number, number]
  near?: number
  far?: number
  controls?: boolean
}

defineProps<{ camera?: CameraProps }>()

const { uuid } = useSharedLechesControls()

const config = provideGameConfig()

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
  <Game :camera="camera">
    <slot />
  </Game>
</template>
