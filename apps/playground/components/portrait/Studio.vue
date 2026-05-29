<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { framingForRig, type PortraitFraming } from '~/utils/portraitRigPresets'

// `active` is a shallowRef. usePortraitStudio() returns a PLAIN object, so nested
// refs are NOT auto-unwrapped when accessed as `studio.active` in a template.
// Destructure it so the template can reference `active` directly (auto-unwrapped).
const { active, captured, failed } = usePortraitStudio()

// The subject emits an auto-framed camera (computed from its bounding box) just
// before capture. Until then, use the per-rig preset as a sensible initial frame.
const liveFrame = ref<PortraitFraming | null>(null)
const framing = computed(() => liveFrame.value ?? framingForRig(active.value?.rig))

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
</script>

<template>
  <div class="portrait-studio">
    <TresCanvas
      :alpha="true"
      :antialias="true"
      :preserve-drawing-buffer="true"
    >
      <TresPerspectiveCamera
        :position="framing.cameraPosition"
        :look-at="framing.lookAt"
        :fov="framing.fov"
      />
      <PortraitLights />

      <Suspense>
        <PortraitSubject
          v-if="active"
          :key="captureKey"
          :descriptor="active"
          @framed="liveFrame = $event"
          @captured="onCaptured"
          @failed="onFailed"
        />
      </Suspense>
    </TresCanvas>
  </div>
</template>

<style scoped>
/* Off-screen (not display:none) so the canvas keeps rendering. */
.portrait-studio {
  position: fixed;
  top: 0;
  left: -9999px;
  width: 512px;
  height: 512px;
  opacity: 0;
  pointer-events: none;
}
</style>
