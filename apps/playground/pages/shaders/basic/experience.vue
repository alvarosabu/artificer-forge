<script setup lang="ts">
import { Floor } from '@artificer-forge/engine/runtime'
import { abs, add, color, dot, float, mix, mx_fractal_noise_float, mx_worley_noise_float, normalView, positionLocal, positionViewDirection, pow, sin, smoothstep, time, uniform, vec3 } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';

import { ghostMaterial } from '@artificer-forge/vfx';

const sphereRef = ref()

const NdotV = dot(normalView, positionViewDirection).abs()

const { colorA } = useControls({
    colorA: {
        value: '#ff0000',
        type: 'color',
    },
    colorB: {
        value: '#00ff00',
        type: 'color',
    },
})

const colorANode = uniform(color('#ff0000'))
const colorBNode = uniform(color('#00ff00'))
const material = new MeshPhysicalNodeMaterial()
const t = time.mul(0.8)
const freq = positionLocal.y.mul(Math.PI)
const shape = sin(freq.add(t))
const factor = smoothstep(float(0.0), float(1.0), NdotV)
const noiseFactor = mx_fractal_noise_float(factor, 4, 2.0, 4.0)
material.colorNode = mix(colorANode, colorBNode, positionLocal.y)
material.transparent = true


watch(sphereRef, (sphere) => {
    if(sphere) {
        sphere.material = material
    }
})

watchEffect(() => {
    colorANode.value.set(colorA!.value)
})
</script>

<template>
    <TresFog :args="['#020420', 10, 30]" />
    <TresAmbientLight />
    <TresDirectionalLight :position="[-3, 4, 2]" />
    <TresPerspectiveCamera :position="5" />
    <OrbitControls />
    <Floor />
    <TresMesh ref="sphereRef" :position="[0, 1, 0]">
        <TresSphereGeometry :args="[1, 32, 32 ]" />
    </TresMesh>
</template>
