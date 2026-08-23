<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { useGameStore } from '../stores/game'
import type { CameraControllerProps } from '../camera'
import { useSceneRefs } from '../useSceneRefs';
import { computed, shallowRef, toValue } from 'vue';
import { Camera, MathUtils, Vector3 } from 'three';
import { useLoop } from '@tresjs/core';

// Shared camera + orbit controls for every Game scene. Lives inside <Game> so the
// active PerspectiveCamera resolves via useTresContext() for any consumer (e.g.
// DialogCameraDirector). Controls auto-disable while input is blocked (dialogs, etc).
const props = withDefaults(defineProps<CameraControllerProps>(), {
  position: () => [12.86, 12.57, 15.52],
  near: 0.1,
  far: 100,
  controls: true,
  fov: 40,
  maxPolarAngle: Math.PI / 2,
  minPolarAngle: Math.PI / 2,
  maxDistance: 100,
  minDistance: 0.1,
  follow: false,
  followHeight: 1.2,
  followSmoothing: 6,
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

  // The offset OrbitControls left us this frame. The drag, the damping and the
  // polar clamp are all already inside it, which is why we read it back rather
  // than track angles of our own.
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
