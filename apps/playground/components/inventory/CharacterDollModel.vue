<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import type { TresObject3D } from '@tresjs/core'
import { useCharacterAnimations, type RigSize } from '@artificer-forge/composables'
import type { Equipment } from '~/stores/game'

const props = defineProps<{
  modelUrl: string
  rigKey: string
  equipment: Equipment
}>()

// Await the GLTF load so the parent <Suspense> resolves once the model is ready.
const { nodes, execute } = useGLTF(props.modelUrl, { draco: true })
await execute()

// The rig is a named node inside the GLTF (e.g. 'Rig_Medium'), not the scene root.
// useEquipment relies on useGraph(rig) to resolve the hand bones.
const rig = computed<TresObject3D | undefined>(() => nodes.value?.[props.rigKey])

const equipmentRef = computed(() => props.equipment)
useEquipment(rig, equipmentRef)

// Plays the idle animation automatically once the animation packs load.
const rigSize = props.rigKey.replace('Rig_', '') as RigSize
useCharacterAnimations(rig, rigSize)
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
  />
</template>
