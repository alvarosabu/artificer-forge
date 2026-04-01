import { Vector3 } from 'three'
import { AnimationName, useSceneRefs } from '@artificer-forge/composables'

const MELEE_RANGE = 1.5
const ATTACK_ANIM_MS = 800
const HURT_ANIM_MS = 600

function rollDamage(stats: Record<string, number> = {}): { value: number, critical: boolean } {
  const d6 = Math.floor(Math.random() * 6) + 1
  const strMod = Math.floor(((stats.strength ?? 10) - 10) / 2)
  const critical = d6 === 6
  const value = critical ? d6 * 2 + strMod : d6 + strMod
  return { value: Math.max(1, value), critical }
}

export const useCombatStore = defineStore('combat', () => {
  const gameStore = useGameStore()
  const { getCharacterRef } = useSceneRefs()

  const isTargeting = ref(false)
  const isAttacking = ref(false)
  const hoveredTargetId = ref<string | null>(null)
  const cursorWorldPoint = ref<Vector3 | null>(null)

  function enterTargeting() {
    if (isAttacking.value) return
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
    cancelTargeting()
    executeAttack(entityId)
  }

  function executeAttack(targetId: string) {
    if (isAttacking.value) return
    const attackerId = gameStore.party.leader
    if (!attackerId) return

    const attackerRef = getCharacterRef(attackerId)
    const targetRef = getCharacterRef(targetId)
    if (!attackerRef || !targetRef) return

    const attackerPos = gameStore.getEntity(attackerId)?.position
    const targetPos = gameStore.getEntity(targetId)?.position
    if (!attackerPos || !targetPos) return

    isAttacking.value = true

    const aVec = new Vector3(attackerPos.x, attackerPos.y, attackerPos.z)
    const tVec = new Vector3(targetPos.x, targetPos.y, targetPos.z)
    const dir = aVec.clone().sub(tVec).normalize()
    const meleePos = tVec.clone().add(dir.multiplyScalar(MELEE_RANGE))
    meleePos.y = 0

    attackerRef.moveTo(meleePos)

    let arrived = false
    attackerRef.onArrive(() => {
      if (arrived) return
      arrived = true

      attackerRef.meleeAttack()

      setTimeout(() => {
        const targetEntity = gameStore.getEntity(targetId)
        if (!targetEntity) { isAttacking.value = false; return }

        const { value, critical } = rollDamage(targetEntity.stats ?? {})
        const newHp = Math.max(0, (targetEntity.hp ?? 0) - value)

        gameStore.updateEntity(targetId, { hp: newHp })
        targetRef.showDamage(value, 'physical', critical)
        targetRef.play(AnimationName.HIT_A, 0.2)

        setTimeout(() => {
          targetRef.play(AnimationName.IDLE_A, 0.3)
          attackerRef.play(AnimationName.IDLE_A, 0.3)
          isAttacking.value = false
        }, HURT_ANIM_MS)
      }, ATTACK_ANIM_MS)
    })
  }

  return {
    isTargeting,
    isAttacking,
    hoveredTargetId,
    enterTargeting,
    cancelTargeting,
    hoverTarget,
    confirmTarget,
    updateCursorPoint,
    cursorWorldPoint,
  }
})
