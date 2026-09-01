<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { useGameStore } from '../stores/game'
import { CAMERA_DEFAULTS, type CameraControllerProps } from '../camera'
import { useSceneRefs } from '../useSceneRefs';
import { computed, shallowRef, toValue, watch } from 'vue';
import { Camera, MathUtils, Vector3 } from 'three';
import { useLoop } from '@tresjs/core';

// Lives inside <Game> so consumers (DialogCameraDirector) get the camera via useTresContext().
const props = withDefaults(defineProps<CameraControllerProps>(), {
  position: () => CAMERA_DEFAULTS.position,
  near: CAMERA_DEFAULTS.near,
  far: CAMERA_DEFAULTS.far,
  controls: CAMERA_DEFAULTS.controls,
  fov: CAMERA_DEFAULTS.fov,
  maxPolarAngle: CAMERA_DEFAULTS.maxPolarAngle,
  minPolarAngle: CAMERA_DEFAULTS.minPolarAngle,
  maxDistance: CAMERA_DEFAULTS.maxDistance,
  minDistance: CAMERA_DEFAULTS.minDistance,
  follow: CAMERA_DEFAULTS.follow,
  followHeight: CAMERA_DEFAULTS.followHeight,
  followSmoothing: CAMERA_DEFAULTS.followSmoothing,
})

const gameStore = useGameStore()
const { getCharacterRef } = useSceneRefs()

const orbitRef = shallowRef<typeof OrbitControls | null>(null)
const controls = computed(() => toValue(orbitRef.value?.instance) ?? null)

const followId = computed(() => {
  if (!props.follow) return null
  return typeof props.follow === 'string' ? props.follow : gameStore.party.leader
})

const anchor = new Vector3()
const smoothAnchor = new Vector3()
const offset = new Vector3()
let acquire: 'authored' | null = 'authored'

// Re-seat when follow turns back on, or the loop resumes from the free camera's offset.
watch(followId, (id) => { if (id) acquire = 'authored' })


function readAnchor(): Vector3 | null {
  const id = followId.value
  if (!id) return null

  const position = getCharacterRef(id)?.getPosition()
  if (!position) return null
  return anchor.set(position.x, position.y + props.followHeight, position.z)
}

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, camera: active }) => {
  const cam = active.value
  const orbit = controls.value
  if (!cam || !orbit || !props.follow) return

  const point = readAnchor()
  if (!point) return

  if (acquire) {
    seat(cam, orbit, point)
    acquire = null
    return
  }

  // Read the offset back from OrbitControls (drag, damping, polar clamp already
  // applied) instead of tracking angles of our own.
  offset.copy(cam.position).sub(orbit.target)

  smoothAnchor.lerp(point, 1 - Math.exp(-props.followSmoothing * delta))

  orbit.target.copy(smoothAnchor)
  cam.position.copy(smoothAnchor).add(offset)
}, 20)

function seat(cam: Camera, orbit: typeof OrbitControls | null, point: Vector3) {
  const [px, py, pz] = props.position
  const [tx, ty, tz] = props.target ?? [0, 0, 0]
  offset.set(px - tx, py - ty, pz - tz)

  const length = offset.length() || 1
  offset.multiplyScalar(MathUtils.clamp(length, props.minDistance, props.maxDistance) / length)

  smoothAnchor.copy(point)
  orbit?.target.copy(point)
  cam.position.copy(point).add(offset)
  cam.lookAt(orbit?.target ?? new Vector3())
}
</script>

<template>
  <TresPerspectiveCamera
    :position="props.position"
    :near="props.near"
    :far="props.far"
    :fov="props.fov"
    v-bind="props.lookAt ? { lookAt: props.lookAt } : {}"
  />
  <OrbitControls
    v-if="props.controls"
    ref="orbitRef"
    :enabled="!gameStore.inputBlocked"
    :maxPolarAngle="props.maxPolarAngle"
    :minPolarAngle="props.minPolarAngle"
    :maxDistance="props.maxDistance"
    :minDistance="props.minDistance"
    v-bind="props.target ? { target: props.target } : {}"
  />
</template>
