import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Vector3 } from 'three'
import { useEventListener } from '@vueuse/core'
import { useSceneRefs } from '../useSceneRefs'
import { useAbilitySystem } from '../useAbilitySystem'
import { useGameStore } from './game'

export const useCombatStore = defineStore('combat', () => {
  const gameStore = useGameStore()
  const { getCharacterRef } = useSceneRefs()

  const isTargeting = ref(false)
  const hoveredTargetId = ref<string | null>(null)
  const cursorWorldPoint = ref<Vector3 | null>(null)

  function enterTargeting() {
    isTargeting.value = true
    document.body.classList.add('cursor-crosshair')
  }

  function cancelTargeting() {
    isTargeting.value = false
    hoveredTargetId.value = null
    cursorWorldPoint.value = null
    document.body.classList.remove('cursor-crosshair')
  }

  function updateCursorPoint(point: Vector3) {
    if (!isTargeting.value) return
    cursorWorldPoint.value = point

    const leaderId = gameStore.party.leader
    if (!leaderId) return
    const leaderRef = getCharacterRef(leaderId)
    leaderRef?.lookAt(point)
  }

  function hoverTarget(entityId: string | null) {
    if (!isTargeting.value) return
    if (!entityId) { hoveredTargetId.value = null; return }
    const entity = gameStore.getEntity(entityId)
    hoveredTargetId.value = entity?.team === 'hostile' ? entityId : null
  }

  function confirmTarget(entityId: string) {
    if (!isTargeting.value) return
    const entity = gameStore.getEntity(entityId)
    if (entity?.team !== 'hostile') return

    const abilitySystem = useAbilitySystem()
    if (abilitySystem.phase.value === 'selecting') {
      // Ground-targeting AoE: clicking an enemy also confirms placement
      if (abilitySystem.activeAbility.value?.targeting === 'ground') {
        abilitySystem.confirmGroundTarget()
        return
      }
      abilitySystem.confirmLockOnTarget(entityId)
      if (abilitySystem.phase.value !== 'selecting') {
        cancelTargeting()
      }
    }
  }

  // Keyboard/mouse cancellation
  if (typeof document !== 'undefined') {
    useEventListener(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTargeting.value) {
        const abilitySystem = useAbilitySystem()
        if (abilitySystem.phase.value !== 'idle') {
          abilitySystem.cancel()
        }
        cancelTargeting()
      }
    })

    useEventListener(document, 'contextmenu', (e: MouseEvent) => {
      if (isTargeting.value) {
        e.preventDefault()
        const abilitySystem = useAbilitySystem()
        if (abilitySystem.phase.value !== 'idle') {
          abilitySystem.cancel()
        }
        cancelTargeting()
      }
    })
  }

  return {
    isTargeting,
    hoveredTargetId,
    enterTargeting,
    cancelTargeting,
    hoverTarget,
    confirmTarget,
    updateCursorPoint,
    cursorWorldPoint,
  }
})
