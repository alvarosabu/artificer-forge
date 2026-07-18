<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterAnimations, useEquipment, useGameStore, useModularArmor, useModularRig } from '@artificer-forge/engine/runtime'

const props = defineProps<{
  characterId: string
}>()

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.characterId))

// Own cloned rig instance — the world scene renders its own copy of this
// entity and Three objects can't live in two scenes at once.
const { rig } = useModularRig(() => entity.value?.appearance, useModularArmor(() => props.characterId))

const equipment = computed(() => gameStore.derivedEquipment(props.characterId))
useEquipment(rig, equipment)

// Plays the idle animation automatically once the animation packs load.
useCharacterAnimations(rig, 'Medium')
</script>

<template>
  <primitive
    v-if="rig"
    :object="rig"
  />
</template>
