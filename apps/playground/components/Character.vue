<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import { useCharacterAnimations, AnimationName } from '~/composables/useCharacterAnimations'

const { nodes } = useGLTF('/models/Ranger.glb')

const rig = computed(() => nodes.value?.Rig_Medium)

const { actions, currentAnimName, play, stop } = useCharacterAnimations(rig)

defineExpose({
  play,
  stop,
  currentAnimName,
  actions,
  AnimationName,
})
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
    cast-shadow
    receive-shadow
  />
</template>
