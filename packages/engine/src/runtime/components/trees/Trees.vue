<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Object3D } from 'three'
import type { Texture, Vector3 } from 'three'
import type { TresColor } from '@tresjs/core'
import Foliage from '../foliage/Foliage.vue'
import type { GradingContext } from '../../grading/grading'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

interface TreesProps {
  /** Blob markers from extractCanopyReferences: position = centre, uniform scale = radius in metres. */
  references: Object3D[]
  foliageTexture?: Texture | null
  colorA?: TresColor
  colorB?: TresColor
  /** Leaf quads per blob. A tree carries more, smaller leaves than a bush does. */
  amount?: number
  /** Leaf quad edge in metres at a cluster scale of 1 — scaled per blob from there. */
  leafSize?: number
  /** Taste multiplier on the marker radius, for fluffing the canopy past its marker. */
  canopyScale?: number
  seed?: string
  lightingDirection?: Vector3
  grading?: GradingContext | null
  windAngle?: number
  windStrength?: number
}

const props = withDefaults(defineProps<TreesProps>(), {
  references: () => [],
  colorA: '#3c6b2f',
  colorB: '#86b544',
  amount: 150,
  leafSize: 0.5,
  canopyScale: 1,
  seed: 'trees',
  grading: null,
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
})

// A marker's radius is the silhouette we want, but Foliage's scale means something
// smaller: the cluster CORE reaches scale * 1, then leaf quads of scale * leafSize get
// billboarded around each anchor, so the blob really reaches scale * (1 + leafSize / 2).
// Feeding the radius in raw overshoots by that much and the canopy swallows the trunk.
const clusters = computed(() => {
  const overshoot = 1 + props.leafSize / 2
  return props.references.map((reference) => {
    const cluster = new Object3D()
    cluster.position.setFromMatrixPosition(reference.matrixWorld)
    cluster.scale.setScalar(reference.matrixWorld.getMaxScaleOnAxis() / overshoot * props.canopyScale)
    cluster.updateMatrixWorld()
    return cluster
  })
})

// createFoliage() bakes the reference list into instance buffers and the leaf count
// into the geometry, both at setup — so these need a new component, not a prop update.
// Level HMR and the leches sliders below both land here.
const version = ref(0)
watch([clusters, () => props.amount, () => props.seed], () => version.value++)
</script>

<template>
  <!-- No trample map on purpose: the trample squash pulls anchors toward y = 0, which
       is the ground under a bush but five metres under a canopy. -->
  <Foliage
    v-if="clusters.length"
    :key="version"
    :references="clusters"
    :foliage-texture="foliageTexture"
    :color-a="colorA"
    :color-b="colorB"
    :amount="amount"
    :size="leafSize"
    :seed="seed"
    :lighting-direction="lightingDirection"
    :grading="grading"
    :wind-angle="windAngle"
    :wind-strength="windStrength"
  />
</template>
