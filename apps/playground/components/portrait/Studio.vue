<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { framingForRig } from '~/utils/portraitRigPresets'

// `active` is a shallowRef. usePortraitStudio() returns a PLAIN object, so nested
// refs are NOT auto-unwrapped when accessed as `studio.active` in a template.
// Destructure it so the template can reference `active` directly (auto-unwrapped).
const { active, captured, failed } = usePortraitStudio()
const framing = computed(() => framingForRig(active.value?.rig))

const armed = ref(false)
const captureKey = ref(0) // forces a fresh <PortraitSubject> mount per bake

function onReady() {
  armed.value = true
}

function onCaptured(url: string) {
  armed.value = false
  captureKey.value++
  captured(url)
}

function onFailed(err: unknown) {
  armed.value = false
  captureKey.value++
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
      <!-- 3-point rig: key / fill / rim -->
      <TresAmbientLight :intensity="0.6" />
      <TresDirectionalLight
        :position="[2, 3, 3]"
        :intensity="2.2"
      />
      <TresDirectionalLight
        :position="[-3, 1, 2]"
        :intensity="0.8"
      />
      <TresDirectionalLight
        :position="[0, 2, -4]"
        :intensity="1.4"
      />

      <Suspense>
        <PortraitSubject
          v-if="active"
          :key="captureKey"
          :descriptor="active"
          @ready="onReady"
        />
      </Suspense>

      <PortraitCapture
        :armed="armed"
        @captured="onCaptured"
        @failed="onFailed"
      />
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
