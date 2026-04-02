<script setup lang="ts">
import { watch } from 'vue'
import { Object3D, Texture } from 'three'
import { Fn, texture, uv } from 'three/tsl'
import { createFoliage, FoliageOptions } from './foliage'

const props = withDefaults(defineProps<FoliageOptions>(), {
    references: () => [],
    colorA: '#b4b536',
    colorB: '#d8cf3b',
})

const { geometry, material } = createFoliage(props)

watch(() => props.foliageTexture, (tex) => {
    console.log('[Foliage] watch fired, tex:', tex)
    if (!tex) return
    material.opacityNode = texture(tex, uv()).r
    material.needsUpdate = true
}, { immediate: true, deep: true })

</script>

<template>
    <TresMesh :geometry="geometry" :material="material" />
</template>