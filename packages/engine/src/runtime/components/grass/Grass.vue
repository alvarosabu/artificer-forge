<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, ColorRepresentation } from 'three'
import { createGrass, type GrassOptions } from './grass'

const props = withDefaults(defineProps<GrassOptions>(), {
  subdivisions: 200,
  size: 30,
  colorA: '#b4b536',
  colorB: '#d8cf3b',
})

const { geometry, material, uniforms, dispose } = createGrass(props)

watch(() => props.colorA, (val) => uniforms.colorA.value.set(new Color(val as ColorRepresentation)))
watch(() => props.colorB, (val) => uniforms.colorB.value.set(new Color(val as ColorRepresentation)))
onUnmounted(dispose)
</script>

<template>
  <TresMesh :geometry="geometry" :material="material" name="Grass" :frustum-culled="false" />
</template>