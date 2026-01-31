<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import { useCharacterAnimations, AnimationName } from '~/composables/useCharacterAnimations'

const props = withDefaults(defineProps<{
  model?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
}>(), {
  model: '/models/Ranger.glb',
  position: () => [0, 0, 0],
  rotation: () => [0, 0, 0],
})

const { nodes } = useGLTF(props.model)

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
  <TresGroup :position="props.position" :rotation="props.rotation">
    <primitive
      v-if="rig"
      :object="rig"
      cast-shadow
      receive-shadow
    />
  </TresGroup>
</template>
