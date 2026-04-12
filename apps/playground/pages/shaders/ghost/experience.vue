<script setup lang="ts">

import { Floor } from '@artificer-forge/components/tres'
import { DoubleSide, MeshStandardNodeMaterial } from 'three/webgpu'
import { ghostMaterial } from '@artificer-forge/vfx'

const { color: emissionColor, glowStrength, fresnelPower } = useControls({
  color: {
    value: '#00ffff',
    type: 'color',
  },
  glowStrength: {
    value: 12.0,
    type: 'number',
    min: 0,
    max: 100,
  },
  fresnelPower: {
    value: 1.5,
    type: 'number',
    min: 0,
    max: 10,
  },
})

const { noiseScale, noiseSpeed, noiseIntensity } = useControls('noise', {
  scale: {
    value: 1.5,
    type: 'number',
    min: 0,
    max: 10,
  },
  speed: {
    value: 0.3,
    type: 'number',
    min: 0,
    max: 2,
  },
  intensity: {
    value: 0.5,
    type: 'number',
    min: 0,
    max: 1,
  },
})

const { material, uniforms } = ghostMaterial({
  color: emissionColor!.value,
  glowStrength: glowStrength!.value,
  fresnelPower: fresnelPower!.value,
})


watch(() => emissionColor!.value, val => uniforms.color.value.set(val))
watch(() => glowStrength!.value, val => { uniforms.glowStrength.value = val })
watch(() => fresnelPower!.value, val => { uniforms.fresnelPower.value = val })

watch(() => noiseScale!.value, val => { uniforms.noiseScale.value = val })
watch(() => noiseSpeed!.value, val => { uniforms.noiseSpeed.value = val })
watch(() => noiseIntensity!.value, val => { uniforms.noiseIntensity.value = val })

</script>

<template>
    <TresFog :args="['#020420', 10, 30]" />
    <TresAmbientLight />
    <TresDirectionalLight :position="[-3, 4, 2]" />
    <TresPerspectiveCamera :position="5" />
    <OrbitControls />
    <Floor />
    <TresMesh :material="material" :position="[0, 1, 0]">
        <TresSphereGeometry :args="[1, 32, 32 ]" />
    </TresMesh>
</template>
