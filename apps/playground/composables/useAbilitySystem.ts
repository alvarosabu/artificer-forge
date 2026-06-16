import { createSharedComposable } from '@vueuse/core'
import { type Group, Vector3 } from 'three'
import { useTres } from '@tresjs/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { rollDice } from '@artificer-forge/utils'
import { useProjectile } from '~/composables/useProjectile'
import { AnimationName, useSceneRefs } from '@artificer-forge/engine/runtime'
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

const MELEE_RANGE = 1.5
const ATTACK_ANIM_MS = 800
const HURT_ANIM_MS = 600
const PROJECTILE_STAGGER_MS = 200
const RECOVER_MS = 500

interface AbilityTemplate {
  abilityId: string
  name: string
  type: 'melee' | 'ranged-projectile' | 'ranged-aoe' | 'utility'
  targeting: 'lock-on' | 'ground' | 'self'
  animations: {
    targeting?: string
    execute: string
    recover?: string
  }
  projectile?: {
    model?: string
    visual?: string
    color?: string
    speed: number
    arc: 'distance-based' | 'straight' | 'parabolic'
  }
  aoe?: {
    shape: 'circle' | 'cone' | 'line'
    radius?: number
    width?: number
    angle?: number
  }
  damage?: { dice: string, type: string, stat: string }
  range?: { normal: number, long?: number }
  cost: 'action' | 'bonusAction' | 'free'
  baseProjectiles?: number
  scalingStat?: string
  scalingThreshold?: number
}

type TargetingPhase = 'idle' | 'selecting' | 'executing'

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const ABILITY_WEAPON_SLOT: Record<string, 'mainHand' | 'offHand' | 'none'> = {
  'melee': 'mainHand',
  'ranged-projectile': 'offHand',
  'ranged-aoe': 'mainHand',
  'utility': 'mainHand',
}

function resolveWeaponSlot(template: AbilityTemplate): 'mainHand' | 'offHand' | 'none' {
  // Magic abilities (visual projectiles or AoE spells) hide all weapons
  if (template.projectile?.visual || template.type === 'ranged-aoe') return 'none'
  return ABILITY_WEAPON_SLOT[template.type] ?? 'mainHand'
}

export const useAbilitySystem = createSharedComposable(() => {
  const gameStore = useGameStore()
  const combatStore = useCombatStore()
  const aoeSystem = useAoESystem()
  const { getCharacterRef } = useSceneRefs()
  const { scene } = useTres()
  const { spawnProjectile } = useProjectile()
  const damageTypeStore = useDamageTypeStore()
  const { setActiveWeaponSlot } = useActionBar()

  const phase = ref<TargetingPhase>('idle')
  const activeAbility = ref<AbilityTemplate | null>(null)
  const collectedTargets = ref<string[]>([])
  const requiredTargets = ref(0)
  const currentTargetIndex = ref(0)
  let cachedProjectileModel: Group | undefined

  async function loadAndAttachProjectile(casterId: string, modelPath: string) {
    try {
      const gltf = await gltfLoader.loadAsync(modelPath)
      const model = gltf.scene as Group
      cachedProjectileModel = model
      const casterRef = getCharacterRef(casterId)
      casterRef?.attachToHand('offHand', model.clone())
    }
    catch (err) {
      console.warn('Failed to load projectile model:', err)
    }
  }

  function resolveProjectileCount(ability: AbilityTemplate, casterId: string): number {
    const base = ability.baseProjectiles ?? 1
    if (!ability.scalingStat || !ability.scalingThreshold) return base
    const caster = gameStore.getEntity(casterId)
    const statValue = caster?.stats?.[ability.scalingStat] ?? 10
    const bonus = Math.max(0, Math.floor((statValue - ability.scalingThreshold) / 4))
    return base + bonus
  }

  async function activateAbility(abilityId: string) {
    if (phase.value !== 'idle') return

    const template = await queryCollection('abilities')
      .where('abilityId', '=', abilityId)
      .first() as unknown as AbilityTemplate | null

    if (!template) {
      console.warn(`Ability not found: ${abilityId}`)
      return
    }

    const attackerId = gameStore.party.leader
    if (!attackerId) return

    activeAbility.value = template
    setActiveWeaponSlot(resolveWeaponSlot(template))

    if (template.targeting === 'lock-on') {
      const count = template.type === 'melee' ? 1 : resolveProjectileCount(template, attackerId)
      requiredTargets.value = count
      currentTargetIndex.value = 0
      collectedTargets.value = []
      phase.value = 'selecting'
      combatStore.enterTargeting()

      // Stop any active movement to prevent idle override on arrival
      const attackerRef = getCharacterRef(attackerId)
      attackerRef?.cancelMovement()

      // Attach arrow to bow hand during targeting
      if (template.projectile?.model) {
        loadAndAttachProjectile(attackerId, template.projectile.model)
      }

      // Play targeting animation clamped on last frame while selecting
      if (template.animations.targeting) {
        attackerRef?.play(template.animations.targeting as any, { fadeTime: 0.2, once: true })
      }
    }
    else if (template.targeting === 'ground') {
      const attackerPos = gameStore.getEntity(attackerId)?.position
      if (!attackerPos) return

      phase.value = 'selecting'
      combatStore.enterTargeting()

      const attackerRef = getCharacterRef(attackerId)
      attackerRef?.cancelMovement()

      // Play targeting animation while selecting ground target
      if (template.animations.targeting) {
        attackerRef?.play(template.animations.targeting as any, { fadeTime: 0.2, once: true })
      }

      aoeSystem.startPreview(
        scene.value,
        new Vector3(attackerPos.x, 0, attackerPos.z),
        {
          shape: template.aoe!.shape,
          radius: template.aoe!.radius,
          width: template.aoe!.width,
          angle: template.aoe!.angle,
          color: damageTypeStore.get(template.damage?.type ?? 'fire')?.color ?? '#ff4444',
          range: template.range?.normal ?? 10,
        },
      )
    }
  }

  function confirmLockOnTarget(entityId: string) {
    if (phase.value !== 'selecting' || !activeAbility.value) return
    if (activeAbility.value.targeting !== 'lock-on') return

    const entity = gameStore.getEntity(entityId)
    if (entity?.team !== 'hostile') return

    const attackerId = gameStore.party.leader
    if (!attackerId) return
    const attackerPos = gameStore.getEntity(attackerId)?.position
    const targetPos = entity.position
    if (!attackerPos || !targetPos) return

    // Range check for ranged abilities (melee handles approach in executeMelee)
    if (activeAbility.value.range && activeAbility.value.type !== 'melee') {
      const dist = Math.sqrt(
        (attackerPos.x - targetPos.x) ** 2 + (attackerPos.z - targetPos.z) ** 2,
      )
      const maxRange = activeAbility.value.range.long ?? activeAbility.value.range.normal
      if (dist > maxRange) return
    }

    collectedTargets.value.push(entityId)
    currentTargetIndex.value++

    if (currentTargetIndex.value >= requiredTargets.value) {
      combatStore.cancelTargeting()
      if (activeAbility.value.type === 'melee') {
        executeMelee()
      }
      else {
        executeProjectiles()
      }
    }
  }

  function confirmGroundTarget() {
    if (phase.value !== 'selecting' || !activeAbility.value) return
    if (activeAbility.value.targeting !== 'ground') return

    combatStore.cancelTargeting()
    const hitIds = aoeSystem.confirm()
    executeAoE(hitIds)
  }

  async function executeMelee() {
    if (!activeAbility.value) { reset(); return }
    phase.value = 'executing'

    const ability = activeAbility.value
    const attackerId = gameStore.party.leader!
    const attackerRef = getCharacterRef(attackerId)
    const targetId = collectedTargets.value[0]
    const targetRef = getCharacterRef(targetId)
    if (!attackerRef || !targetRef) { reset(); return }

    const attackerEntity = gameStore.getEntity(attackerId)
    const targetEntity = gameStore.getEntity(targetId)
    if (!attackerEntity || !targetEntity) { reset(); return }

    const tVec = new Vector3(targetEntity.position.x, targetEntity.position.y, targetEntity.position.z)
    const aVec = new Vector3(attackerEntity.position.x, attackerEntity.position.y, attackerEntity.position.z)
    const dir = aVec.clone().sub(tVec).normalize()
    const meleePos = tVec.clone().add(dir.multiplyScalar(MELEE_RANGE))
    meleePos.y = 0

    // Move to melee range
    attackerRef.moveTo(meleePos)

    return new Promise<void>((resolve) => {
      let arrived = false
      attackerRef.onArrive(() => {
        if (arrived) return
        arrived = true

        attackerRef.meleeAttack()

        setTimeout(() => {
          if (!ability.damage) { reset(); resolve(); return }

          const statValue = attackerEntity.stats?.[ability.damage.stat] ?? 10
          const { total, critical } = rollDice(ability.damage.dice, statValue)
          gameStore.applyDamage(targetId, total, ability.damage.type)
          targetRef.showDamage(total, ability.damage.type, critical)
          const newHp = gameStore.getEntity(targetId)?.hp ?? 0

          if (newHp <= 0) {
            targetRef.play(AnimationName.DEATH_A, { fadeTime: 0.2, once: true })
            setTimeout(() => targetRef.play(AnimationName.DEATH_A_POSE, { fadeTime: 0.3, once: true }), 1200)
          }
          else {
            targetRef.play(AnimationName.HIT_A, { fadeTime: 0.2, once: true })
          }

          setTimeout(() => {
            if (newHp > 0) targetRef.play(AnimationName.IDLE_A, 0.3)
            attackerRef.play(AnimationName.IDLE_A, 0.3)
            reset()
            resolve()
          }, HURT_ANIM_MS)
        }, ATTACK_ANIM_MS)
      })
    })
  }

  async function executeProjectiles() {
    if (!activeAbility.value) return
    phase.value = 'executing'

    const ability = activeAbility.value
    const attackerId = gameStore.party.leader!
    const attackerRef = getCharacterRef(attackerId)
    const attackerEntity = gameStore.getEntity(attackerId)
    if (!attackerRef || !attackerEntity) { reset(); return }

    const attackerPos = new Vector3(
      attackerEntity.position.x,
      attackerEntity.position.y + 1.2,
      attackerEntity.position.z,
    )

    // Play release animation, detach arrow shortly after release point
    attackerRef.play(ability.animations.execute as any, { fadeTime: 0.2, once: true })
    await delay(150)

    // Detach arrow from hand and use as projectile model
    let projectileModel: Group | undefined
    if (ability.projectile?.model) {
      attackerRef.detachFromHand('offHand')
      projectileModel = cachedProjectileModel
      cachedProjectileModel = undefined
    }

    // Face the first target before firing
    const firstTarget = gameStore.getEntity(collectedTargets.value[0])
    if (firstTarget) {
      attackerRef.lookAt(new Vector3(firstTarget.position.x, firstTarget.position.y + 1.0, firstTarget.position.z))
    }

    // Fire all projectiles nearly simultaneously with small random delays
    const projectilePromises = collectedTargets.value.map((targetId, i) => {
      const stagger = Math.random() * PROJECTILE_STAGGER_MS
      return delay(stagger).then(async () => {
        const targetEntity = gameStore.getEntity(targetId)
        const targetRef = getCharacterRef(targetId)
        if (!targetEntity || !targetRef) return

        const targetPos = new Vector3(
          targetEntity.position.x,
          targetEntity.position.y + 1.0,
          targetEntity.position.z,
        )

        await spawnProjectile({
          from: attackerPos.clone(),
          to: targetPos,
          speed: ability.projectile!.speed,
          arc: ability.projectile!.arc,
          model: projectileModel,
          visual: ability.projectile?.visual as 'orb' | undefined,
          color: ability.projectile?.color,
        })

        // Apply damage on arrival
        if (ability.damage) {
          const statValue = attackerEntity.stats?.[ability.damage.stat] ?? 10
          const { total, critical } = rollDice(ability.damage.dice, statValue)
          gameStore.applyDamage(targetId, total, ability.damage.type)
          targetRef.showDamage(total, ability.damage.type, critical)
          const newHp = gameStore.getEntity(targetId)?.hp ?? 0

          if (newHp <= 0) {
            targetRef.play(AnimationName.DEATH_A, { fadeTime: 0.2, once: true })
            setTimeout(() => targetRef.play(AnimationName.DEATH_A_POSE, { fadeTime: 0.3, once: true }), 1200)
          }
          else {
            targetRef.play(AnimationName.HIT_A, { fadeTime: 0.2, once: true })
            setTimeout(() => targetRef.play(AnimationName.IDLE_A, 0.3), HURT_ANIM_MS)
          }
        }
      })
    })

    await Promise.all(projectilePromises)

    // Recover → idle
    if (ability.animations.recover) {
      attackerRef.play(ability.animations.recover as any, 0.2)
      await delay(RECOVER_MS)
    }
    attackerRef.play(AnimationName.IDLE_A, 0.3)
    reset()
  }

  async function executeAoE(hitIds: string[]) {
    if (!activeAbility.value) { reset(); return }
    phase.value = 'executing'

    const ability = activeAbility.value
    const attackerId = gameStore.party.leader!
    const attackerRef = getCharacterRef(attackerId)
    const attackerEntity = gameStore.getEntity(attackerId)
    if (!attackerRef || !attackerEntity) { reset(); return }

    attackerRef.play(ability.animations.execute as any, { fadeTime: 0.2, once: true })
    await delay(ATTACK_ANIM_MS)

    for (const targetId of hitIds) {
      const targetEntity = gameStore.getEntity(targetId)
      const targetRef = getCharacterRef(targetId)
      if (!targetEntity || !targetRef) continue

      if (ability.damage) {
        const statValue = attackerEntity.stats?.[ability.damage.stat] ?? 10
        const { total, critical } = rollDice(ability.damage.dice, statValue)
        gameStore.applyDamage(targetId, total, ability.damage.type)
        targetRef.showDamage(total, ability.damage.type, critical)
        const newHp = gameStore.getEntity(targetId)?.hp ?? 0

        if (newHp <= 0) {
          targetRef.play(AnimationName.DEATH_A, { fadeTime: 0.2, once: true })
          setTimeout(() => targetRef.play(AnimationName.DEATH_A_POSE, { fadeTime: 0.3, once: true }), 1200)
        }
        else {
          targetRef.play(AnimationName.HIT_A, { fadeTime: 0.2, once: true })
          setTimeout(() => targetRef.play(AnimationName.IDLE_A, 0.3), HURT_ANIM_MS)
        }
      }
    }

    if (ability.animations.recover) {
      attackerRef.play(ability.animations.recover as any, 0.2)
      await delay(RECOVER_MS)
    }
    else {
      await delay(RECOVER_MS)
    }
    attackerRef.play(AnimationName.IDLE_A, 0.3)
    reset()
  }

  function cancel() {
    // Return attacker to idle if was in targeting pose
    if (phase.value === 'selecting') {
      const attackerId = gameStore.party.leader
      if (attackerId) {
        const attackerRef = getCharacterRef(attackerId)
        attackerRef?.play(AnimationName.IDLE_A, 0.3)
        // Detach arrow from hand if it was attached for targeting
        if (activeAbility.value?.projectile?.model) {
          attackerRef?.detachFromHand('offHand')
          cachedProjectileModel = undefined
        }
      }
    }
    if (activeAbility.value?.targeting === 'ground') {
      aoeSystem.cancelPreview()
    }
    combatStore.cancelTargeting()
    reset()
  }

  function reset() {
    phase.value = 'idle'
    activeAbility.value = null
    collectedTargets.value = []
    requiredTargets.value = 0
    currentTargetIndex.value = 0
    setActiveWeaponSlot('mainHand')
  }

  return {
    phase: readonly(phase),
    activeAbility: readonly(activeAbility),
    currentTargetIndex: readonly(currentTargetIndex),
    requiredTargets: readonly(requiredTargets),
    activateAbility,
    confirmLockOnTarget,
    confirmGroundTarget,
    cancel,
  }
})
