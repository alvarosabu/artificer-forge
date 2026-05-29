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
    // One rAF ensures at least one frame with the model has been rendered.
    requestAnimationFrame(() => {
      try {
        const canvas = renderer.instance.domElement as HTMLCanvasElement
        emit('captured', canvas.toDataURL('image/png'))
      }
      catch (err) {
        emit('failed', err)
      }
    })
  },
)
</script>

<template>
  <TresGroup />
</template>
