<script setup lang="ts">
import { Object3D } from 'three'
import { Floor, Foliage } from '@artificer-forge/components/tres'
import { OrbitControls } from '@tresjs/cientos'

const references = [
  { position: [2, 0, -3] as [number, number, number], scale: 1.0 },
  { position: [-4, 0, 1] as [number, number, number], scale: 0.8 },
  { position: [5, 0, 4] as [number, number, number], scale: 1.2 },
  { position: [-2, 0, -5] as [number, number, number], scale: 0.9 },
  { position: [0, 0, 6] as [number, number, number], scale: 1.1 },
].map(({ position, scale }) => {
  const obj = new Object3D()
  obj.position.set(...position)
  obj.scale.setScalar(scale)
  obj.updateMatrixWorld()
  return obj
})

const { state: foliageTexture } = useTexture('/textures/foliage/foliage.png')

watch(foliageTexture, (tex) => {
  console.log('[Experience] watch fired, tex:', tex)

}, { immediate: true, deep: true })

</script>

<template>
  <TresPerspectiveCamera :position="[8, 6, 8]" :look-at="[0, 0, 0]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />
  <Floor />
  <Foliage
    :references="references"
    :foliage-texture="foliageTexture"
    color-a="#b4b536"
    color-b="#d8cf3b"
  />
</template>
