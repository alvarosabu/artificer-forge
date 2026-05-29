<script setup lang="ts">
// Shared 3-point portrait lighting (key / fill / rim). Used by both the bake
// studio and the portrait lab so the lab preview matches the baked output.
</script>

<template>
  <TresAmbientLight :intensity="0.6" />
  <TresDirectionalLight
    :position="[2, 3, 3]"
    :intensity="2.2"
  />
  <TresDirectionalLight
    :position="[-3, 1, 2]"
    :intensity="0.8"
  />
  <TresDirectionalLight
    :position="[0, 2, -4]"
    :intensity="1.4"
  />
</template>
