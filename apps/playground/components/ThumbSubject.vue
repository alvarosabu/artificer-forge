<script setup lang="ts">
import { onScopeDispose, shallowRef } from 'vue'
import { useTresContext } from '@tresjs/core'
import { Color } from 'three'
import type { Bone, Object3D } from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { loadGltf } from '../utils/sharedGltf'
import { findHeadMesh, hasSkinnedMesh, headFrame, rebindClone, THUMB_HAIR, THUMB_HEAD_GRAY, THUMB_HORN, THUMB_SKIN, tintMaterialNamed } from '../utils/modularRig'
import type { ThumbDescriptor } from '../composables/useModularThumbnails'
import type { Vec3 } from '@artificer-forge/engine/runtime'

// One-shot subject for a single thumbnail bake. Remounted per bake (keyed by the
// descriptor). Everything loads through the SHARED loader (one DRACO decoder) and
// is CLONED per bake, so the cached GLTFs stay pristine and no WASM piles up.
// Assembles rig + base head + optional part in bind pose, frames the head, captures.

const props = defineProps<{ descriptor: ThumbDescriptor }>()
const emit = defineEmits<{
  head: [Vec3, number]
  captured: [string]
  failed: [unknown]
}>()

// Must resolve synchronously (before the first await) for inject to see the provider.
const { renderer } = useTresContext()

const isHead = props.descriptor.slot === 'head'

const rigGltf = await loadGltf(props.descriptor.rigPath)
const headGltf = await loadGltf(props.descriptor.headPath)
const partGltf = isHead ? null : await loadGltf(props.descriptor.partPath)

function findNamed(root: Object3D, name: string): Object3D | undefined {
  let found: Object3D | undefined
  root.traverse((o) => { if (!found && o.name === name) found = o })
  return found
}

const root = skeletonClone(rigGltf.scene)
const rigRoot = shallowRef<Object3D>(root)

function assemble() {
  const headBone = (() => {
    let bone: Bone | undefined
    root.traverse((o) => { if (!bone && (o as Bone).isBone && o.name === 'head') bone = o as Bone })
    return bone
  })()

  // Heads ship both ways: medium-rig heads are RIGID props authored in
  // head-bone space (attach to the bone); small-rig (GOB_) heads are SKINNED,
  // authored in rig space (rebind to this rig's bones, add at the root).
  const headSrc = findNamed(headGltf.scene, props.descriptor.headId)
  if (headSrc) {
    let headNode: Object3D | undefined
    if (hasSkinnedMesh(headSrc)) {
      const boneByName = new Map<string, Bone>()
      root.traverse((o) => { if ((o as Bone).isBone) boneByName.set(o.name, o as Bone) })
      headNode = rebindClone(headSrc, boneByName)
      root.add(headNode)
    }
    else if (headBone) {
      headNode = skeletonClone(headSrc)
      headBone.add(headNode)
    }
    if (headNode) tintMaterialNamed(headNode, 'Skin')?.color?.set(new Color(isHead ? THUMB_SKIN : THUMB_HEAD_GRAY))
  }

  if (partGltf) {
    const part = skeletonClone(partGltf.scene)
    part.traverse((o) => { (o as { frustumCulled?: boolean }).frustumCulled = false })
    tintMaterialNamed(part, 'Hair')?.color?.set(new Color(THUMB_HAIR))
    tintMaterialNamed(part, 'Horns')?.color?.set(new Color(THUMB_HORN))
    root.add(part)
  }
}

function frameAndCapture() {
  assemble()
  root.updateWorldMatrix(true, true)

  const headMesh = findHeadMesh(root)
  if (headMesh) {
    const { center, height } = headFrame(headMesh)
    emit('head', center, height)
  }

  // Two rAFs: first draws with the freshly-framed camera, second guarantees the
  // frame is in the (preserved) drawing buffer before readback.
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

// Assemble + capture once the primitive is mounted. onScopeDispose guards a late run.
const raf = requestAnimationFrame(frameAndCapture)
onScopeDispose(() => cancelAnimationFrame(raf))
</script>

<template>
  <primitive :object="rigRoot" />
</template>
