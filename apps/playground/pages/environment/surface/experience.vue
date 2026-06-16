<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { Floor } from '@artificer-forge/engine/runtime'
import type { TresPointerEvent } from '@tresjs/core'
import type { SurfaceKind } from '@artificer-forge/engine/core'

const uuid = inject<string>('unique-uuid')

const { surfaceTool, surfaceKind } = useControls('surface', {
  tool: {
    value: 'paint' as 'paint' | 'lightning' | 'cold',
    options: [
      { text: '🖌️ Paint', value: 'paint' },
      { text: '⚡ Lightning', value: 'lightning' },
      { text: '❄️ Cold', value: 'cold' },
    ],
  },
  kind: {
    value: 'water' as SurfaceKind,
    options: [
      { text: '💧 Water', value: 'water' },
      { text: '☠️ Poison', value: 'poison' },
      { text: '🩸 Blood', value: 'blood' },
      { text: '🛢️Oil', value: 'oil' },
      { text: '🔥 Fire', value: 'fire' },
    ],
  },
}, { uuid })

// This page is now just the paint UI on top of the surface abstraction. Clicks
// seed the shared engine; SurfaceSystem (global, in Game.vue) renders the result.
// No local grid/textures/material/sim loop anymore.
const { seed, event, clear, dimensions } = useSurface()

// Paint mode seeds the selected kind; lightning/cold modes apply an event that
// flood-fills the liquid pool under the click (no-op on bare ground / non-liquids).
function onPaint(e: TresPointerEvent) {
  if (!e.point) return
  const tool = surfaceTool?.value ?? 'paint'
  if (tool === 'paint') {
    if (!surfaceKind?.value) return
    seed(e.point.x, e.point.z, surfaceKind.value)
  }
  else {
    event(e.point.x, e.point.z, tool)
  }
}

// Singleton engine: wipe painted state so it doesn't leak into the next scene.
onUnmounted(() => clear())
</script>

<template>
  <TresPerspectiveCamera :position="[8, 6, 8]" :look-at="[0, 0, 0]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />

  <Floor />
  <!-- Invisible paint target sized to the surface field. Invisible meshes with
       listeners still raycast in Tres, so clicks seed the engine while the
       rendered surface planes (listener-free) let clicks fall through to here. -->
  <TresMesh
    name="surface-paint-target"
    :position="[0, 0.05, 0]"
    :visible="false"
    @click="onPaint"
  >
    <TresPlaneGeometry :args="[dimensions.width, dimensions.depth]" :rotate-x="-Math.PI / 2" />
  </TresMesh>
</template>
