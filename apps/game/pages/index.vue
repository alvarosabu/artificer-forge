<script setup lang="ts">
import { TresLeches, useControls } from '@tresjs/leches'
import { Physics } from '@tresjs/rapier'
import { WindLines } from '@artificer-forge/engine/runtime'
import { useDofFocusProvider, useOutlinePassProvider } from '@artificer-forge/post-processing'
import { PCFShadowMap } from 'three'

useHead({
  title: 'Game Concept',
  meta: [
    { name: 'description', content: 'A TresJS Nuxt application' }
  ]
})

const uuid = 'game-canvas'
provide('uuid', uuid)

// EffectComposer throws without the outline provider, even with no outlines in use.
useOutlinePassProvider()
useDofFocusProvider()

const player = providePlayer()
provideProximityPrompts()
providePhone()

useAchievementCommands()

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
  <TresLeches
    :uuid="uuid"
    collapsed
  />
  <TresCanvas
    window-size
    :dpr="[1, 1.5]"
    shadows
    :alpha="false"
    :shadow-map-type="PCFShadowMap"
  >
    <CameraController :target="player.position" />
    <EnvironmentController
      v-slot="{ wind, dayPhase }"
      :focus="player.position"
    >
    <AudioController :day-phase="dayPhase">
      <!-- Physics loads Rapier's WASM in an async setup, so it needs Suspense. -->
      <Suspense>
        <!-- One step per frame instead of the default fixed 1/60: tres-rapier copies body positions
             without interpolation, so a fixed step shows the player at 60 Hz on faster screens. -->
        <Physics
          time-step="vary"
          :debug="physicsDebug"
        >
          <Island v-slot="{ heightField, heightAt, spawn, spawns, waterAt, grassAt, surfaceAt }">
            <Chamo
              :spawn="spawnOn(spawn, heightAt)"
              :height-field="heightField"
              :water-at="waterAt"
              :grass-at="grassAt"
              :surface-at="surfaceAt"
            />
            <RobotEmpanadas
              v-if="spawns.Robot_Empanadas"
              :position="spawnOn(spawns.Robot_Empanadas.position, heightAt)"
              :yaw="spawns.Robot_Empanadas.yaw"
              :height-field="heightField"
            />
          </Island>
        </Physics>
      </Suspense>
      </AudioController>
      <!-- WindLines spawns at an absolute height, so the lines follow the player over the terrain -->
      <WindLines
        :wind-angle="wind.angle"
        :intensity="wind.strength"
        :origin-x="player.position[0]"
        :origin-z="player.position[2]"
        :height="player.position[1] + 2"
        :radius="15"
      />
      <PostProcessing />
    </EnvironmentController>
  </TresCanvas>
  <PhoneMenu />
</template>