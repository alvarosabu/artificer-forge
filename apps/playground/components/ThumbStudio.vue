<script setup lang="ts">
import { computed, onErrorCaptured, ref, shallowRef, watchEffect } from 'vue'
import { TresCanvas } from '@tresjs/core'
import type { PerspectiveCamera } from 'three'
import { frameFromHead, type PortraitFraming, PortraitLights, type Vec3 } from '@artificer-forge/engine/runtime'
import ThumbSubject from './ThumbSubject.vue'
import { useModularThumbnails } from '../composables/useModularThumbnails'

// Off-screen studio that bakes modular-part thumbnails one at a time, reusing the
// portrait 3-point lighting so thumbnails match the in-game portrait look. Mirrors
// the engine's PortraitStudio, but assembles modular parts instead of a full model.

const { active, captured, failed } = useModularThumbnails()

// Framing knobs: tight enough to read detail, still fitting tall hair/beards.
const FRAME_OPTS = { viewHeight: 1.95, headLift: 0.18, cameraHeightOffset: 0.02, yaw: 12, fov: 30 }

const NEUTRAL: PortraitFraming = { cameraPosition: [0, 1.6, 3], lookAt: [0, 1.6, 0], fov: 30 }
const liveFrame = ref<PortraitFraming | null>(null)
const framing = computed(() => liveFrame.value ?? NEUTRAL)

function onHead(center: Vec3, height: number) {
  liveFrame.value = frameFromHead(center, height, FRAME_OPTS)
}

const camRef = shallowRef<PerspectiveCamera>()
watchEffect(() => {
  const cam = camRef.value
  if (!cam) return
  const f = framing.value
  cam.position.set(f.cameraPosition[0], f.cameraPosition[1], f.cameraPosition[2])
  cam.fov = f.fov
  cam.updateProjectionMatrix()
  cam.lookAt(f.lookAt[0], f.lookAt[1], f.lookAt[2])
})

function onCaptured(url: string) {
  liveFrame.value = null
  captured(url)
}
function onFailed(err: unknown) {
  liveFrame.value = null
  failed(err)
}

// A Suspense/load failure would otherwise deadlock the serialized queue.
onErrorCaptured((err) => {
  onFailed(err)
  return false
})

const studioStyle = {
  position: 'fixed',
  top: '0',
  left: '-9999px',
  width: '256px',
  height: '256px',
  opacity: '0',
  pointerEvents: 'none',
} as const
</script>

<template>
  <div :style="studioStyle">
    <TresCanvas
      :alpha="false"
      :antialias="true"
      :preserve-drawing-buffer="true"
      render-mode="always"
      clear-color="#12141a"
    >
      <TresPerspectiveCamera ref="camRef" />
      <PortraitLights />
      <!-- Extra fill: brighten thumbnails without altering the shared (in-game) portrait look. -->
      <TresAmbientLight :intensity="0.6" />
      <TresDirectionalLight :position="[0, 2, 4]" :intensity="1.1" />
      <Suspense>
        <ThumbSubject
          v-if="active"
          :key="active.key"
          :descriptor="active"
          @head="onHead"
          @captured="onCaptured"
          @failed="onFailed"
        />
      </Suspense>
    </TresCanvas>
  </div>
</template>
