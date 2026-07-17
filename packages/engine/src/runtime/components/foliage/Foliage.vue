<script setup lang="ts">
import { watch } from 'vue'
import { Color } from 'three'
import { useLoop } from '@tresjs/core'
import { createFoliage, FoliageOptions } from './foliage'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<FoliageOptions>(), {
    references: () => [],
    colorA: '#b4b536',
    colorB: '#d8cf3b',
    amount: 80,
    size: 0.8,
    seed: 'foliage',
    windAngle: DEFAULT_WIND_ANGLE,
    windStrength: DEFAULT_WIND_STRENGTH,
})

const { geometry, material, uniforms, count, setTexture } = createFoliage(props)

watch(() => props.colorA, (val) => uniforms.colorA.value.set(new Color(val as Color)))
watch(() => props.colorB, (val) => uniforms.colorB.value.set(new Color(val as Color)))
watch(() => props.lightingDirection, (val) => { if (val) uniforms.lightingDir.value.copy(val) })
watch(() => props.windAngle, (angle) => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })

watch(() => props.foliageTexture, (tex) => {
    if (!tex) return
    setTexture(tex)
}, { immediate: true, deep: true })

// localTime accumulates scaled by strength so wind speed responds to the slider
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
    uniforms.wind.localTime.value += delta * uniforms.wind.timeFrequency.value * uniforms.wind.strength.value
})
</script>

<template>
    <TresInstancedMesh
        :args="[geometry, material, count]"
        cast-shadow
        receive-shadow
        :frustum-culled="false"
    />
</template>
