<script setup lang="ts">
const { onBeforeRender } = useLoop()

const torusKnotRef = shallowRef<TresObject | null>(null)

onBeforeRender(({ elapsed }) => {
  if (torusKnotRef.value) {
    torusKnotRef.value.rotation.y = elapsed
    torusKnotRef.value.rotation.z = elapsed
  }
})
</script>

<template>
  <TresPerspectiveCamera :position="[7, 7, 7]" />
  <OrbitControls />
  <TresAmbientLight
    :intensity="0.5"
    color="red"
  />
  <TresMesh
    ref="torusKnotRef"
    :position="[0, 2, 0]"
  >
    <TresTorusKnotGeometry :args="[1, 0.4, 100, 32]" />
    <TresMeshToonMaterial color="#00dc82" />
  </TresMesh>
  <TresDirectionalLight
    :position="[0, 2, 4]"
    :intensity="1"
    cast-shadow
  />
  <TresAxesHelper />
  <TresGridHelper :args="[10, 10, 0x444444, '#00dc82']" />
</template>