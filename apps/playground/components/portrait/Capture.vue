<script setup lang="ts">
import { useTresContext } from '@tresjs/core'

const props = defineProps<{ armed: boolean }>()
const emit = defineEmits<{ captured: [string], failed: [unknown] }>()

// In the installed @tresjs/core (#1400 preview), useTresContext() returns a plain
// TresContext object whose `renderer` is the renderer manager (not a ref). The
// WebGLRenderer instance lives at `renderer.instance`, and its backing canvas at
// `renderer.instance.domElement`.
const { renderer } = useTresContext()

watch(
  () => props.armed,
  (armed) => {
    if (!armed) return
    // Two rAFs: the first lets the Tres render loop run a frame with the freshly
    // posed model; the second guarantees that frame is in the drawing buffer before
    // we read it. One rAF alone is order-dependent and can capture a stale frame.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const canvas = renderer.instance.domElement as HTMLCanvasElement
          emit('captured', canvas.toDataURL('image/png'))
        }
        catch (err) {
          emit('failed', err)
        }
      })
    })
  },
)
</script>

<template>
  <!-- Renderless: exists only to live inside <TresCanvas> so it can read the renderer context. -->
  <TresGroup />
</template>
