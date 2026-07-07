<script setup lang="ts">
// M3 test harness subject — throwaway once Character.vue consumes useModularRig.
import { watch } from 'vue'
import { AnimationName, useCharacterAnimations, useModularRig, type ArmorPiece } from '@artificer-forge/engine/runtime'
import type { CharacterAppearance } from '@artificer-forge/engine/core'

const props = defineProps<{
  appearance: CharacterAppearance
  armor?: ArmorPiece[]
}>()

const { rig } = useModularRig(() => props.appearance, () => props.armor ?? [])
const { play, actions } = useCharacterAnimations(rig)
watch(() => [Object.keys(actions).length, rig.value] as const, ([n, r]) => {
  if (n && r) play(AnimationName.IDLE_A)
}, { immediate: true })
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
  />
</template>
