<script setup lang="ts">
import { computed, onScopeDispose, toRef, watch } from 'vue'
import { Box3, type Mesh, Vector3 } from 'three'
import { useGLTF } from '@tresjs/cientos'
import { type TresObject3D, useTresContext } from '@tresjs/core'
import { AnimationName, type RigSize, useCharacterAnimations } from '../../useCharacterAnimations'
import { useEquipment } from '../../useEquipment'
import { useModularRig } from '../../modular/useModularRig'
import type { Vec3 } from '../../portrait/portraitRigPresets'
import type { PortraitSubjectDescriptor } from '../../portrait/usePortraitStudio'

const props = withDefaults(defineProps<{
  descriptor: PortraitSubjectDescriptor
  // When false, render only (no toDataURL bake) — used by the portrait lab.
  autoCapture?: boolean
}>(), { autoCapture: true })
const emit = defineEmits<{
  captured: [string]
  failed: [unknown]
  // Head mesh world-box centre + height. Drives the portrait camera; consistent
  // across characters and scaled to the actual head size.
  head: [Vec3, number]
  // Full-model bounds — used by the lab for the orbit target / readout only.
  bounds: [Vec3, Vec3]
}>()

// Capture happens from inside this component (a child of <TresCanvas>, within the
// <Suspense> boundary) because that is where the Tres context resolves. A sibling
// of <Suspense> injects against the SLOT-OWNER scope and cannot see the provider.
// Must be called synchronously, BEFORE the first await, for inject to resolve.
const { renderer } = useTresContext()

// Setup-time branch, mirroring Actor.vue: a subject is either modular
// (assembled from appearance parts) or single-GLB.
const isModular = !!props.descriptor.appearance

async function useSingleGltfRig() {
  // Await load so the parent <Suspense> only resolves once the model is ready.
  const { nodes, execute } = useGLTF(props.descriptor.model!, { draco: true })
  await execute()
  // The rig is a named node inside the GLTF (e.g. 'Rig_Medium'), not the scene root.
  return computed<TresObject3D | undefined>(() => nodes.value?.[props.descriptor.rig])
}

// Modular parts load incrementally AFTER Suspense resolves; the capture below
// waits for the assembly to settle instead of assuming the rig is complete.
const rig = isModular
  ? useModularRig(() => props.descriptor.appearance, () => props.descriptor.armor ?? []).rig
  : await useSingleGltfRig()

useEquipment(rig, toRef(() => props.descriptor.equipment))

const rigSize = props.descriptor.rig.replace('Rig_', '') as RigSize
const { play, actions } = useCharacterAnimations(rig, rigSize)

// Locate the body head mesh (e.g. 'Hero_Head', 'Fenrath_Head'). Prefer a
// SkinnedMesh so an attached helmet/accessory named "...head..." can't win.
function findHeadMesh(root: TresObject3D): Mesh | undefined {
  let skinned: Mesh | undefined
  let any: Mesh | undefined
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !/head/i.test(o.name)) return
    any ??= mesh
    if ((mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned ??= mesh
  })
  return skinned ?? any
}

function captureFrame() {
  // Two rAFs: the first lets the Tres render loop draw a frame with the freshly
  // framed camera; the second guarantees that frame has been presented to the
  // canvas before we read it back with toDataURL.
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

// Wait for the mesh assembly to settle before framing: modular parts, armor and
// equipment attach asynchronously even after the idle action is ready. Two
// consecutive identical mesh counts (and at least one mesh) = settled; the try
// cap bails before the studio's 10s watchdog if a part never lands.
function whenSettled(done: () => void) {
  let prev = -1
  let stable = 0
  let tries = 0
  const tick = () => {
    let count = 0
    rig.value?.traverse((o) => {
      if ((o as Mesh).isMesh) count++
    })
    if (count > 0 && count === prev) stable++
    else {
      stable = 0
      prev = count
    }
    tries++
    if (stable >= 2 || tries >= 25) return done()
    settleTimer = setTimeout(tick, 150)
  }
  settleTimer = setTimeout(tick, 200)
}

watch(
  () => actions[AnimationName.IDLE_A],
  (idle) => {
    if (signaled || !idle) return
    signaled = true
    play(AnimationName.IDLE_A)
    whenSettled(() => {
      // The idle pose has settled and world matrices are valid, so the head mesh
      // world box (hence framing) is accurate.
      if (rig.value) {
        // Self-shadowing (hair on forehead, chin on neck) is a big part of the
        // authored-portrait look; rig assembly only sets castShadow.
        rig.value.traverse((o) => {
          const mesh = o as Mesh
          if (mesh.isMesh) {
            mesh.castShadow = true
            mesh.receiveShadow = true
          }
        })
        rig.value.updateWorldMatrix(true, true)

        // Bounds are emitted for the lab's orbit target / readout only — framing
        // no longer derives from them (a cloak/weapon would skew the box).
        const box = new Box3().setFromObject(rig.value)
        emit('bounds', box.min.toArray() as Vec3, box.max.toArray() as Vec3)

        // Frame off the HEAD MESH box: consistent across characters and scaled to
        // the real head size (not the head-bone height, which overshoots tall rigs
        // like the werewolf). Prefer the skinned body head over any helmet/accessory.
        const headMesh = findHeadMesh(rig.value)
        if (headMesh) {
          const headBox = new Box3().setFromObject(headMesh)
          const center = new Vector3()
          headBox.getCenter(center)
          const headHeight = Math.max(headBox.max.y - headBox.min.y, 0.001)
          emit('head', [center.x, center.y, center.z], headHeight)
        }
        else {
          // No head mesh (custom rig): fall back to the upper bounding box.
          const min = box.min.toArray() as Vec3
          const max = box.max.toArray() as Vec3
          const sizeY = max[1] - min[1]
          const cx = (min[0] + max[0]) / 2
          const cz = (min[2] + max[2]) / 2
          emit('head', [cx, max[1] - sizeY * 0.15, cz], sizeY * 0.3)
        }
      }
      // Let the new camera apply + render, then capture (skipped in lab preview).
      if (props.autoCapture) captureFrame()
    })
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
