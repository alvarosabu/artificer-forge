<script setup lang="ts">
import { watch } from 'vue'
import { Color } from 'three'
import { Fn, texture, uv, vec4 } from 'three/tsl'
import { createFoliage, FoliageOptions } from './foliage'

const props = withDefaults(defineProps<FoliageOptions>(), {
    references: () => [],
    colorA: '#b4b536',
    colorB: '#d8cf3b',
    amount: 80,
    size: 0.8,
    seed: 'foliage',
})

const { geometry, material, uniforms, count } = createFoliage(props)

watch(() => props.colorA, (val) => uniforms.colorA.value.set(new Color(val as Color)))
watch(() => props.colorB, (val) => uniforms.colorB.value.set(new Color(val as Color)))
watch(() => props.lightingDirection, (val) => { if (val) uniforms.lightingDir.value.copy(val) })

watch(() => props.foliageTexture, (tex) => {
    if (!tex) return
    material.opacityNode = texture(tex, uv()).r
    material.castShadowNode = Fn(() => {
        const alphaColor = texture(tex, uv()).r  // default UVs, no rotation
        alphaColor.lessThan(0.5).discard()
        return vec4(0, 1, 1, 1)  // WebGPU shadow pass convention — not RGBA color
    })()
    material.needsUpdate = true
}, { immediate: true, deep: true })
</script>

<template>
    <TresInstancedMesh
        :args="[geometry, material, count]"
        cast-shadow
        :frustum-culled="false"
    />
</template>
