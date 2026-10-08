<script setup lang="ts">
import { createWebGPURenderer } from '@artificer-forge/engine/runtime'
import { TresLeches, useControls } from '@tresjs/leches'
import { Physics } from '@tresjs/rapier'
import { PCFShadowMap } from 'three'

useHead({
  title: 'Game Concept',
  meta: [
    { name: 'description', content: 'A TresJS Nuxt application' }
  ]
})

const uuid = 'game-canvas'
provide('uuid', uuid)

// Chamo writes this as it moves and the camera follows it.
const playerPosition = ref<[number, number, number]>([0, 0, 0])

// Snap the spawn point to the terrain, so an empty placed a bit high or low still lands on the ground.
function spawnOn(
  [x, y, z]: [number, number, number],
  heightAt: (x: number, z: number) => number | null,
): [number, number, number] {
  return [x, heightAt(x, z) ?? y, z]
}

useControls('fpsgraph', {
  uuid
})

const { physicsDebug } = useControls('⚛️ physics', {
  debug: false,
}, { uuid })
</script>

<template>
  <TresLeches :uuid="uuid"/>
  <TresCanvas
    window-size
    shadows
    :shadow-map-type="PCFShadowMap"
    :renderer="createWebGPURenderer"
  >
    <CameraController :target="playerPosition" />
    <EnvironmentController>
      <!-- Physics loads Rapier's WASM in an async setup, so it needs Suspense. -->
      <Suspense>
        <!-- One step per frame instead of the default fixed 1/60: tres-rapier copies body positions
             without interpolation, so a fixed step shows the player at 60 Hz on faster screens. -->
        <Physics
          time-step="vary"
          :debug="physicsDebug"
        >
          <Island v-slot="{ heightField, heightAt, spawn }">
            <Chamo
              v-model:position="playerPosition"
              :spawn="spawnOn(spawn, heightAt)"
              :height-field="heightField"
            />
          </Island>
        </Physics>
      </Suspense>
    </EnvironmentController>
  </TresCanvas>
</template>