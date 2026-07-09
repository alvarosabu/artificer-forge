<script setup lang="ts">
import { computed, onErrorCaptured, ref, shallowRef, watchEffect } from 'vue'
import { TresCanvas } from '@tresjs/core'
import type { PerspectiveCamera } from 'three'
import { createWebGPURenderer } from '../../createWebGPURenderer'
import { frameFromHead, PORTRAIT_RENDERING, type PortraitFraming, type Vec3 } from '../../portrait/portraitRigPresets'
import { usePortraitStudio } from '../../portrait/usePortraitStudio'
import PortraitBackground from './Background.vue'
import PortraitLights from './Lights.vue'
import PortraitSubject from './Subject.vue'

// `active` is a shallowRef. usePortraitStudio() returns a PLAIN object, so nested
// refs are NOT auto-unwrapped when accessed as `studio.active` in a template.
// Destructure it so the template can reference `active` directly (auto-unwrapped).
const { active, captured, failed } = usePortraitStudio()

// The subject emits an auto-framed camera (computed from its bounding box) just
// before capture. Until then, a neutral placeholder keeps the camera valid; it's
// overwritten the instant the model's bounds resolve, so its values never bake.
const NEUTRAL_FRAMING: PortraitFraming = {
  cameraPosition: [0, 2, 6] as Vec3,
  lookAt: [0, 2, 0] as Vec3,
  fov: 10,
}
const liveFrame = ref<PortraitFraming | null>(null)
const framing = computed(() => liveFrame.value ?? NEUTRAL_FRAMING)

// The subject emits its head-bone world position + scale; turn that into the
// portrait camera framing.
function onHead(head: Vec3, scale: number) {
  liveFrame.value = frameFromHead(head, scale)
}

// Drive the camera imperatively. Tres does NOT re-apply `:look-at` when only the
// position changes, so a yaw-orbited frame would otherwise capture facing front.
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

const captureKey = ref(0) // forces a fresh <PortraitSubject> mount per bake

function onCaptured(url: string) {
  captureKey.value++
  liveFrame.value = null
  captured(url)
}

function onFailed(err: unknown) {
  captureKey.value++
  liveFrame.value = null
  failed(err)
}

// A <Suspense> load failure (e.g. bad model URL, Draco error) would otherwise
// propagate as an unhandled error: the bake promise never settles and the
// serialized queue deadlocks for every subsequent bake. Route it to failed().
onErrorCaptured((err) => {
  onFailed(err)
  return false
})

// Off-screen (not display:none) so the canvas keeps rendering. Inlined (not a
// scoped <style>) so the engine package builds without a CSS extraction step.
const studioStyle = {
  position: 'fixed',
  top: '0',
  left: '-9999px',
  width: '512px',
  height: '512px',
  opacity: '0',
  pointerEvents: 'none',
} as const
</script>

<template>
  <div :style="studioStyle">
    <!-- No preserve-drawing-buffer: that's a WebGL context option; WebGPU canvases
         stay readable via toDataURL after present. -->
    <TresCanvas
      :alpha="true"
      :antialias="true"
      :renderer="createWebGPURenderer"
      :tone-mapping="PORTRAIT_RENDERING.toneMapping"
      :tone-mapping-exposure="PORTRAIT_RENDERING.toneMappingExposure"
      :shadows="PORTRAIT_RENDERING.shadows"
    >
      <TresPerspectiveCamera ref="camRef">
        <PortraitBackground
          v-if="active?.background"
          :framing="framing"
          :src="active.background"
        />
      </TresPerspectiveCamera>
      <PortraitLights />

      <Suspense>
        <PortraitSubject
          v-if="active"
          :key="captureKey"
          :descriptor="active"
          @head="onHead"
          @captured="onCaptured"
          @failed="onFailed"
        />
      </Suspense>
    </TresCanvas>
  </div>
</template>
