<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'

const { state, nodes } = useGLTF('/models/Ranger.glb')
const { state: animState } = useGLTF('/models/animations/Rig_Medium/Rig_Medium_MovementBasic.glb')

const rig = computed(() => nodes.value?.Rig_Medium)
const animations = computed(() => animState.value?.animations || [])

const { actions } = useAnimations(animations, rig)

watch(actions, (newActions) => {
  const firstActionName = Object.keys(newActions)[0]
  if (firstActionName) {
    newActions[firstActionName]?.play()
  }
}, { immediate: true })
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
    cast-shadow
    receive-shadow
  />
</template>
