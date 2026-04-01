<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { useControls } from '@tresjs/leches'
import { ACESFilmicToneMapping, AgXToneMapping, CineonToneMapping, LinearToneMapping, NeutralToneMapping, NoToneMapping, ReinhardToneMapping } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { useOutlinePassProvider, EffectComposer } from '@artificer-forge/post-processing'
import { TargetReticle, TargetIndicator } from '@artificer-forge/vfx'
import { useEventListener } from '@vueuse/core'
import { useSceneRefs } from '@artificer-forge/composables'

// Debugger

const { uuid } = useSharedLechesControls()

const { state, close, emitAction } = useContextMenuProvider()
useOutlinePassProvider()

const { onSlotActivated } = useActionBar()
const combatStore = useCombatStore()

onSlotActivated((slot) => {
  if (slot.id === 'attack-melee') {
    combatStore.enterTargeting()
  }
})

defineShortcuts({
  escape: () => combatStore.cancelTargeting(),
})

const gameStore = useGameStore()
const { getCharacterRef } = useSceneRefs()

const reticlePosition = computed<[number, number, number]>(() => {
  const id = combatStore.hoveredTargetId
  if (!id) return [0, 0.01, 0]
  const entity = gameStore.getEntity(id)
  if (!entity) return [0, 0.01, 0]
  return [entity.position.x, 0.01, entity.position.z]
})

// Click-to-move: move selected character to clicked point
function handleFloorClick(event: any) {
  if (combatStore.isTargeting) return
  const entityId = gameStore.selectedEntityId
  if (!entityId) return
  getCharacterRef(entityId)?.moveTo(event.point)
}

// Target indicator: show where selected character is moving
const targetIndicatorPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.selectedEntity?.moveTarget
  if (!target) return null
  return [target.x, 0.01, target.z]
})

function handlePointerMissed() {
  close()
}

useEventListener('contextmenu', (e) => {
  if (combatStore.isTargeting) {
    e.preventDefault()
    combatStore.cancelTargeting()
  }
})

function handleContextMenuAction(action: string, entityId: string) {
  emitAction(action, entityId)
}

const createWebGPURenderer = (ctx: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
  return renderer
}

const { toneMapping } = useControls('toneMapping', {
  toneMapping: {
    value: ACESFilmicToneMapping,
    options: [
      { text: 'No Tone Mapping', value: NoToneMapping },
      { text: 'Linear', value: LinearToneMapping },
      { text: 'Reinhard', value: ReinhardToneMapping },
      { text: 'Cineon', value: CineonToneMapping },
      { text: 'ACES Filmic', value: ACESFilmicToneMapping },
      { text: 'AgX', value: AgXToneMapping }, // New in Three.js r155
      { text: 'Neutral', value: NeutralToneMapping },
    ],
  },
}, {uuid})

const { postprocessingBloomStrength, postprocessingBloomThreshold, postprocessingBloomRadius, postprocessingBloomSmoothWidth } = useControls('postprocessing', {
  bloomStrength: {
    value: 0.7,
    min: 0,
    max: 3,
    step: 0.01,
    type: 'range',
  },
  bloomRadius: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
  bloomThreshold: {
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
  bloomSmoothWidth: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
}, {uuid})

</script>

<template>
  <TresLeches :uuid="uuid" collapsed />
  <TresCanvas
    clear-color="#020420"
    window-size
    :renderer="createWebGPURenderer"
    :tone-mapping="NoToneMapping"
    @pointer-missed="handlePointerMissed"
  >
    <slot />
    <TresMesh
      :rotation-x="-Math.PI / 2"
      :position-y="0.001"
      :visible="false"
      @click="handleFloorClick"
      @pointermove="(e: any) => combatStore.updateCursorPoint(e.point)"
    >
      <TresPlaneGeometry :args="[100, 100]" />
      <TresMeshBasicMaterial :opacity="0" transparent />
    </TresMesh>
    <TargetIndicator
      v-if="targetIndicatorPosition"
      :position="targetIndicatorPosition"
      :radius="0.4"
      :height="0.8"
      :pulse-speed="3"
    />
    <TargetReticle
      v-if="combatStore.isTargeting && combatStore.hoveredTargetId"
      :position="reticlePosition"
      color="#ff4444"
      :radius="0.8"
    />
    <EffectComposer
      :outline-presets="{
        party: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
        interactive: { visibleEdgeColor: '#ffcc00', edgeThickness: 3 },
        hostile: { visibleEdgeColor: '#ff4444', edgeThickness: 3 },
        neutral: { visibleEdgeColor: '#ffffff', edgeThickness: 3 },
        ally: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
      }"
      :bloom="{
        strength: postprocessingBloomStrength,
        radius: postprocessingBloomRadius,
        threshold: postprocessingBloomThreshold,
        smoothWidth: postprocessingBloomSmoothWidth,
      }"
    />
  </TresCanvas>
  <EntityContextMenu
    :state="state"
    @update:open="state.open = $event"
    @action="handleContextMenuAction"
  />
  <ActionBar />
</template>