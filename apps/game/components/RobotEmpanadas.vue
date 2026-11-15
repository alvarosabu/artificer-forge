<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { applyGradingToModel, sampleHeight } from '@artificer-forge/engine/runtime'
import type { HeightField } from '@artificer-forge/engine/runtime'
import { CapsuleCollider, RigidBody } from '@tresjs/rapier'
import { LoopRepeat, Vector3 } from 'three'
import { positionWorld, uniform } from 'three/tsl'
import type { AnimationClip, Mesh, Object3D } from 'three'
import type { NodeMaterial } from 'three/webgpu'

const props = withDefaults(defineProps<{
  /** Feet position. Read once on mount, where the body is created. */
  position: [number, number, number]
  /** Turn around Y, in radians. */
  yaw?: number
  /** Ground for the grading's contact occlusion. Without it the ground is y = 0. */
  heightField?: HeightField | null
}>(), {
  yaw: 0,
  heightField: null,
})

const IDLE_CLIP = 'Idle_A'
// Sized to Robot-empanadas.glb: about 2.5 units tall with the chef hat, the body about 0.9 wide.
const CAPSULE_RADIUS = 0.45
const CAPSULE_HEIGHT = 2.2
const capsuleHalfHeight = CAPSULE_HEIGHT / 2 - CAPSULE_RADIUS
const capsuleArgs: [number, number] = [capsuleHalfHeight, CAPSULE_RADIUS]
const capsuleOffset: [number, number, number] = [0, CAPSULE_HEIGHT / 2, 0]

const grading = useGrading()

const { state } = useGLTF('/models/robot-empanadas/Robot-empanadas.glb', { draco: true })
// The robot GLB has the KayKit medium rig but no clips, so they come from the shared animation pack.
const { state: packState } = useGLTF('/models/animations/Rig_Medium/Rig_Medium_General.glb', { draco: true })

const scene = computed(() => state.value?.scene)
const animations = computed<AnimationClip[]>(() => packState.value?.animations ?? [])
const { actions } = useAnimations(animations, scene)

watch(() => actions[IDLE_CLIP], (idle) => {
  idle?.setLoop(LoopRepeat, Infinity).reset().play()
}, { immediate: true })

// Same as Chamo: one shadow lookup above the head, so the world shades the robot but its own arms and hat do not.
const SHADOW_PROBE_HEIGHT = 2.8
const shadowProbe = uniform(new Vector3(props.position[0], props.position[1] + SHADOW_PROBE_HEIGHT, props.position[2]))

function shade(model: Object3D) {
  model.traverse((child) => {
    if ((child as Mesh).isMesh) child.castShadow = child.receiveShadow = true
  })
  const groundHeight = props.heightField ? sampleHeight(props.heightField, positionWorld.xz) : undefined
  applyGradingToModel(model, grading, { groundHeight })
  model.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as NodeMaterial
    material.receivedShadowPositionNode = shadowProbe
    material.needsUpdate = true
  })
}

watch(scene, (model) => {
  if (model) shade(model)
}, { immediate: true })
</script>

<template>
  <RigidBody
    type="fixed"
    :position="props.position"
    :rotation="[0, props.yaw, 0]"
    :collider="false"
  >
    <CapsuleCollider
      :args="capsuleArgs"
      :position="capsuleOffset"
    />
    <primitive
      v-if="scene"
      :object="scene"
    />
  </RigidBody>
</template>
