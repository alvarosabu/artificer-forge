<script setup lang="ts">
import { Box3 } from 'three'
import { useGLTF } from '@tresjs/cientos'
import { type TresObject3D, useTresContext } from '@tresjs/core'
import { AnimationName, type RigSize, useCharacterAnimations } from '@artificer-forge/composables'
import type { PortraitFraming } from '~/utils/portraitRigPresets'
import type { PortraitSubjectDescriptor } from '~/composables/usePortraitStudio'

const props = defineProps<{ descriptor: PortraitSubjectDescriptor }>()
const emit = defineEmits<{ captured: [string], failed: [unknown], framed: [PortraitFraming] }>()

// Capture happens from inside this component (a child of <TresCanvas>, within the
// <Suspense> boundary) because that is where the Tres context resolves. A sibling
// of <Suspense> injects against the SLOT-OWNER scope and cannot see the provider.
// Must be called synchronously, BEFORE the first await, for inject to resolve.
const { renderer } = useTresContext()

// Await load so the parent <Suspense> only resolves once the model is ready.
const { nodes, execute } = useGLTF(props.descriptor.model, { draco: true })
await execute()

// The rig is a named node inside the GLTF (e.g. 'Rig_Medium'), not the scene root.
const rig = computed<TresObject3D | undefined>(() => nodes.value?.[props.descriptor.rig])

useEquipment(rig, toRef(() => props.descriptor.equipment))

const rigSize = props.descriptor.rig.replace('Rig_', '') as RigSize
const { play, actions } = useCharacterAnimations(rig, rigSize)

function captureFrame() {
  // Two rAFs: the first lets the Tres render loop draw a frame with the freshly
  // framed camera; the second guarantees that frame is in the drawing buffer
  // before we read it (preserveDrawingBuffer keeps it readable).
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
}

// Gate on the IDLE_A action specifically, not on "any action loaded": animation
// packs load async OUTSIDE Suspense, so `actions` fills incrementally; signalling
// on the first action risks play() no-op'ing and capturing a bind/T-pose.
let signaled = false
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => actions[AnimationName.IDLE_A],
  (idle) => {
    if (signaled || !idle) return
    signaled = true
    play(AnimationName.IDLE_A)
    settleTimer = setTimeout(() => {
      // After a few frames the idle pose has settled and world matrices are valid,
      // so the bounding box (hence auto-framing) is accurate.
      if (rig.value) {
        const box = new Box3().setFromObject(rig.value)
        emit('framed', frameFromBounds(box.min.toArray(), box.max.toArray()))
      }
      // Let the new camera apply + render, then capture.
      captureFrame()
    }, 200)
  },
  { immediate: true },
)

onScopeDispose(() => clearTimeout(settleTimer))
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
  />
</template>
