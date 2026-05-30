<script setup lang="ts">
// Shared dramatic portrait lighting (key / fill / rim). Used by both the bake
// studio and the portrait lab so the lab preview matches the baked output.
//
// Drama comes from a high key:fill ratio + warm/cool contrast: a strong, steeply
// angled WARM key throws real shadow across the off-cheek, a dim COOL fill barely
// lifts the shadow side (so it stays moody, not flat), and a punchy cool rim
// carves a bright separating edge on hair/shoulders against the backdrop. Ambient
// is kept low — just enough that the shadow side never crushes to pure black.
</script>

<template>
  <TresAmbientLight :intensity="0.18" />
  <!-- Key: warm, high and to the right, steep enough to shadow the far cheek. -->
  <TresDirectionalLight
    :position="[3.5, 4, 2.5]"
    :intensity="2.5"
    color="#fff1dc"
  />
  <!-- Fill: dim + cool, opposite the key; lifts shadows just enough to read form. -->
  <TresDirectionalLight
    :position="[-3.5, 0.5, 2]"
    :intensity="0.35"
    color="#9fb8ff"
  />
  <!-- Rim: punchy cool backlight for a bright silhouette edge. -->
  <TresDirectionalLight
    :position="[-1.5, 3, -4]"
    :intensity="2.6"
    color="#cfe0ff"
  />
</template>
