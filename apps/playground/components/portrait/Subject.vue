<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import type { TresObject3D } from '@tresjs/core'
import { AnimationName, type RigSize, useCharacterAnimations } from '@artificer-forge/composables'
import type { PortraitSubjectDescriptor } from '~/composables/usePortraitStudio'

const props = defineProps<{ descriptor: PortraitSubjectDescriptor }>()
const emit = defineEmits<{ ready: [] }>()

// Await load so the parent <Suspense> only resolves once the model is ready.
const { nodes, execute } = useGLTF(props.descriptor.model, { draco: true })
await execute()

// The rig is a named node inside the GLTF (e.g. 'Rig_Medium'), not the scene root.
const rig = computed<TresObject3D | undefined>(() => nodes.value?.[props.descriptor.rig])

useEquipment(rig, toRef(() => props.descriptor.equipment))

const rigSize = props.descriptor.rig.replace('Rig_', '') as RigSize
const { play, actions } = useCharacterAnimations(rig, rigSize)

// Gate readiness on the IDLE_A action specifically, not on "any action loaded".
// Animation packs load async OUTSIDE Suspense, so `actions` fills incrementally;
// signalling on the first action risks playing before Idle_A's pack arrives,
// which would no-op `play` and capture a bind/T-pose.
let signaled = false
let readyTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => actions[AnimationName.IDLE_A],
  (idle) => {
    if (signaled || !idle) return
    signaled = true
    play(AnimationName.IDLE_A)
    // Let the idle pose settle a few frames before signalling the studio to capture.
    readyTimer = setTimeout(() => emit('ready'), 200)
  },
  { immediate: true },
)

onScopeDispose(() => clearTimeout(readyTimer))
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
  />
</template>
