<script setup lang="ts">
import { Vector3 } from 'three'
import { useLoop } from '@tresjs/core'
import { Html } from '@tresjs/cientos'
import { TargetReticle, TargetIndicator } from '@artificer-forge/vfx'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const combatStore = useCombatStore()
const abilitySystem = useAbilitySystem()
const aoeSystem = useAoESystem()
const { getCharacterRef } = useSceneRefs()
const { onSlotActivated } = useActionBar()

// Update AoE preview each frame when active
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  if (!aoeSystem.isActive.value || !combatStore.cursorWorldPoint) return
  aoeSystem.updatePreview(combatStore.cursorWorldPoint, delta)
})

onSlotActivated((slot) => {
  if (slot.abilityId) {
    abilitySystem.activateAbility(slot.abilityId)
  }
})

const reticlePosition = computed<[number, number, number]>(() => {
  const id = combatStore.hoveredTargetId
  if (!id) return [0, 0.01, 0]
  const entity = gameStore.getEntity(id)
  if (!entity) return [0, 0.01, 0]
  return [entity.position.x, 0.01, entity.position.z]
})

const targetIndicatorPosition = computed<[number, number, number] | null>(() => {
  const target = gameStore.selectedEntity?.moveTarget
  if (!target) return null
  return [target.x, 0.01, target.z]
})

// Trajectory preview for ranged-projectile abilities
const showTrajectory = computed(() => {
  if (!combatStore.isTargeting) return false
  const ability = abilitySystem.activeAbility.value
  return ability?.type === 'ranged-projectile' && !!combatStore.cursorWorldPoint
})

const trajectoryFrom = computed(() => {
  const leaderId = gameStore.party.leader
  if (!leaderId) return new Vector3()
  const entity = gameStore.getEntity(leaderId)
  if (!entity) return new Vector3()
  return new Vector3(entity.position.x, entity.position.y + 1.2, entity.position.z)
})

const trajectoryTo = computed(() => {
  const hovered = combatStore.hoveredTargetId
  if (hovered) {
    const entity = gameStore.getEntity(hovered)
    if (entity) return new Vector3(entity.position.x, entity.position.y + 1.0, entity.position.z)
  }
  const cursor = combatStore.cursorWorldPoint
  if (cursor) return new Vector3(cursor.x, 0, cursor.z)
  return new Vector3()
})

const trajectoryArc = computed(() => {
  const ability = abilitySystem.activeAbility.value
  return ability?.projectile?.arc ?? 'distance-based'
})

const trajectoryEndPosition = computed<[number, number, number]>(() => {
  const to = trajectoryTo.value
  return [to.x, 0.01, to.z]
})

const trajectoryDistance = computed(() => {
  const from = trajectoryFrom.value
  const to = trajectoryTo.value
  const dx = from.x - to.x
  const dz = from.z - to.z
  return Math.sqrt(dx * dx + dz * dz)
})

const trajectoryDistanceLabel = computed(() => `${trajectoryDistance.value.toFixed(1)}m`)

const isOutOfRange = computed(() => {
  const ability = abilitySystem.activeAbility.value
  if (!ability?.range) return false
  const maxRange = ability.range.long ?? ability.range.normal
  return trajectoryDistance.value > maxRange
})

const isMultiTarget = computed(() => abilitySystem.requiredTargets.value > 1)
const projectilesLabel = computed(() => {
  const remaining = abilitySystem.requiredTargets.value - abilitySystem.currentTargetIndex.value
  return `Projectiles: ${remaining}/${abilitySystem.requiredTargets.value}`
})

function handleFloorClick(event: any) {
  // Ground-targeting AoE: confirm placement on click
  if (combatStore.isTargeting && aoeSystem.isActive.value) {
    abilitySystem.confirmGroundTarget()
    return
  }
  if (combatStore.isTargeting) return
  const entityId = gameStore.selectedEntityId
  if (!entityId) return
  getCharacterRef(entityId)?.moveTo(event.point)
}
</script>

<template>
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
    :radius="0.8"
    :height="1.2"
    :pulse-speed="3"
  />
  <TrajectoryPreview
    v-if="showTrajectory"
    :from="trajectoryFrom"
    :to="trajectoryTo"
    :arc="trajectoryArc"
    :color="isOutOfRange ? '#ff4444' : '#ffffff'"
  />
  <TargetIndicator
    v-if="showTrajectory"
    :position="trajectoryEndPosition"
    :radius="0.8"
    :height="1.2"
    :pulse-speed="4"
    :color="isOutOfRange ? '#ff4444' : '#ffffff'"
  />
  <TresGroup v-if="showTrajectory" :position="trajectoryEndPosition">
    <Html center :position-y="1.5" :position-x="-3">
      <div
        class="pointer-events-none select-none font-mono text-sm font-bold flex flex-col items-center gap-0.5"
      >
        <span :class="isOutOfRange ? 'text-red-400' : 'text-white'">
          {{ trajectoryDistanceLabel }}
        </span>
        <span
          v-if="isMultiTarget"
          class="text-xs text-sky-300 text-wrap"
        >
          {{ projectilesLabel }}
        </span>
      </div>
    </Html>
  </TresGroup>
  <TargetReticle
    v-if="combatStore.isTargeting && combatStore.hoveredTargetId"
    :position="reticlePosition"
    color="#ff4444"
    :radius="0.8"
  />
</template>
