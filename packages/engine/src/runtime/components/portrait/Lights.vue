<script setup lang="ts">
import { PORTRAIT_LIGHTS } from '../../portrait/portraitRigPresets'

// Shared dramatic portrait lighting (key / fill / rim / bounce). Used by both the
// bake studio and the portrait lab so the lab preview matches the baked output.
//
// Drama comes from a high key:fill ratio + warm/cool contrast: a strong warm
// shadow-casting key models the face (hair occludes the forehead, chin shades the
// neck), a dim cool fill barely lifts the shadow side, a cool rim carves a bright
// separating edge, and a faint warm hemisphere stands in for ground bounce so
// shadows never crush to black. Backdrop-colored bounce comes from
// scene.environment (see Background.vue) — keep it subtle or everything goes blue.
//
// Everything defaults to PORTRAIT_LIGHTS; the lab overrides via props for live
// tuning.
withDefaults(defineProps<{
  keyIntensity?: number
  keyColor?: string
  fillIntensity?: number
  fillColor?: string
  rimIntensity?: number
  rimColor?: string
  bounceIntensity?: number
}>(), {
  keyIntensity: PORTRAIT_LIGHTS.key,
  keyColor: PORTRAIT_LIGHTS.keyColor,
  fillIntensity: PORTRAIT_LIGHTS.fill,
  fillColor: PORTRAIT_LIGHTS.fillColor,
  rimIntensity: PORTRAIT_LIGHTS.rim,
  rimColor: PORTRAIT_LIGHTS.rimColor,
  bounceIntensity: PORTRAIT_LIGHTS.bounce,
})
</script>

<template>
  <!-- Bounce: warm-neutral, so ambient never tints the face blue. -->
  <TresHemisphereLight
    :args="[PORTRAIT_LIGHTS.bounceSky, PORTRAIT_LIGHTS.bounceGround]"
    :intensity="bounceIntensity"
    name="BounceLight"
  />
  <!-- Key: warm, high and to the right, steep enough to shadow the far cheek. -->
  <TresDirectionalLight
    :position="[3.5, 4, 2.5]"
    :intensity="keyIntensity"
    name="KeyLight"
    :color="keyColor"
    cast-shadow
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-camera-far="20"
    :shadow-bias="-0.0002"
    :shadow-normal-bias="0.04"
    :shadow-radius="4"
  />
  <!-- Fill: dim + cool, opposite the key; lifts shadows just enough to read form. -->
  <TresDirectionalLight
    :position="[-3.5, 0.5, 2]"
    :intensity="fillIntensity"
    name="FillLight"
    :color="fillColor"
  />
  <!-- Rim: cool backlight for a bright silhouette edge. -->
  <TresDirectionalLight
    :position="[-1.5, 3, -4]"
    :intensity="rimIntensity"
    name="RimLight"
    :color="rimColor"
  />
</template>
