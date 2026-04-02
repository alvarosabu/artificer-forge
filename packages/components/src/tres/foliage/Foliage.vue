<script setup lang="ts">
import { Mesh, Object3D } from 'three'
import { createFoliage, FoliageOptions } from './foliage'


const props = withDefaults(defineProps<FoliageOptions>(), {
    references: () => [],
    colorA: '#b4b536',
    colorB: '#d8cf3b',
})

const { geometry, material } = createFoliage(props)
</script>

<template>
    <TresMesh :geometry="geometry" :material="material" />
</template>