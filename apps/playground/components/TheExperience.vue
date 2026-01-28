<script setup lang="ts">
</script>

<template>
  <TresPerspectiveCamera :position="[3, 3, 5]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight
    :position="[5, 5, 5]"
    :intensity="1.5"
    cast-shadow
  />
  <Suspense>
    <RangerModel />
  </Suspense>
  <TresAxesHelper />
  <TresGridHelper :args="[10, 10, 0x444444, '#00dc82']" />
</template>