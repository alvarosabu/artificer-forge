<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { applyGradingToModel, sampleHeight } from '@artificer-forge/engine/runtime'
import type { HeightField, PointLight } from '@artificer-forge/engine/runtime'
import { useControls } from '@tresjs/leches'
import { CapsuleCollider, RigidBody } from '@tresjs/rapier'
import { Color, LoopRepeat, Vector3 } from 'three'
import { positionWorld, uniform } from 'three/tsl'
import type { AnimationClip, Mesh, Object3D } from 'three'
import type { NodeMaterial } from 'three/webgpu'
import { Html } from '@tresjs/cientos/webgpu'

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
const PROMPT_HEIGHT = 2.9

const grading = useGrading()

const { stage } = useProximityPrompt({
  position: () => props.position,
  noticeRadius: 8,
  interactRadius: 4,
})

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

// The stall roof covers the shadow probe, so the robot is all in shadow. A grading point light lifts it back.
const uuid = inject<string>('uuid')
const {
  bulbColor,
  bulbIntensity,
  bulbRadius,
  bulbHeight,
  bulbForward,
} = useControls('💡 bulb', {
  color: '#ffd28a',
  intensity: { value: 1.2, min: 0, max: 5, step: 0.05, type: 'range' },
  radius: { value: 4, min: 0.5, max: 12, step: 0.25, type: 'range' },
  height: { value: 2.85, min: 1, max: 3.2, step: 0.05, type: 'range' },
  forward: { value: 1.3, min: -1.5, max: 1.5, step: 0.05, type: 'range' },
}, { uuid })

const UP = new Vector3(0, 1, 0)
const bulbLight: PointLight = { position: new Vector3(), radius: 4, color: new Color(), intensity: 1, flicker: 0 }
const removeBulbLight = grading.addPointLights([bulbLight])
onUnmounted(removeBulbLight)

watchEffect(() => {
  bulbLight.position.set(0, bulbHeight!.value, bulbForward!.value).applyAxisAngle(UP, props.yaw).add(new Vector3(...props.position))
  bulbLight.radius = bulbRadius!.value
  bulbLight.color.set(bulbColor!.value)
  bulbLight.intensity = bulbIntensity!.value
  grading.updatePointLights()
})
</script>

<template>
  <RigidBody
    type="fixed"
    :position="props.position"
    :rotation="[0, props.yaw, 0]"
    :collider="false"
  >
    <Html
      :position="[0, PROMPT_HEIGHT, 0]"
      :scale="0.05"
    >
      <ProximityPrompt 
        :stage="stage"
        action="Talk"
      />
    </Html>
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
