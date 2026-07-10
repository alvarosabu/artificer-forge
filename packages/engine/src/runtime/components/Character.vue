<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGLTF, Html } from '@tresjs/cientos'
import { useLoop, type TresPointerEvent } from '@tresjs/core'
import { Mesh, Vector3, type Group } from 'three'
import { useDamageNumbers, DamageNumber, ghostMaterial } from '@artificer-forge/vfx'
import { useOutlinePass } from '@artificer-forge/post-processing'
import { AnimationName, type RigSize, useCharacterAnimations } from '../useCharacterAnimations'
import { useModularRig } from '../modular/useModularRig'
import { useModularArmor } from '../modular/useModularArmor'
import { resolvePartRig } from '../modular/partRegistry'
import { useCharacterController } from '../useCharacterController'
import { useContextMenu } from '../useContextMenu'
import { useActionBar } from '../useActionBar'
import { useEquipment } from '../useEquipment'
import { useStatusEffectOverlay } from '../useStatusEffectOverlay'
import { useStatusEffectParticles } from '../useStatusEffectParticles'
import { useStatusEffectAnimations } from '../useStatusEffectAnimations'
import { useStatusEffectTexts } from '../useStatusEffectTexts'
import { usePortraitRenderer } from '../portrait/usePortraitRenderer'
import { useCombatStore } from '../stores/combat'
import { useGameStore } from '../stores/game'
import Nameplate from './Nameplate.vue'
import StatusEffectText from './StatusEffectText.vue'

const { open: openContextMenu } = useContextMenu()
const { addToSelection, removeFromSelection } = useOutlinePass()
const combatStore = useCombatStore()

const props = withDefaults(defineProps<{
  entityId: string
}>(), {
  entityId: '',
})

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))

// Rig source is a setup-time decision: an entity is either modular (assembled
// from appearance parts, skeleton named by its body part) or single-GLB — it
// never switches.
const isModular = !!entity.value?.appearance
const rigKey = computed(() => entity.value?.rig ?? 'Rig_Medium')
const rigSize = computed<RigSize>(() => {
  if (!isModular) return rigKey.value.replace('Rig_', '') as RigSize
  const key = resolvePartRig(entity.value!.appearance!.body)
  return (key[0]!.toUpperCase() + key.slice(1)) as RigSize
})

function useSingleGltfRig() {
  const { state, nodes } = useGLTF(entity.value?.model ?? '', { draco: true })
  // Legacy single-GLB extra: ghost arm demo material.
  watch(nodes, (nodesValue) => {
    if (nodesValue?.Hero_ArmRight) {
      nodesValue.Hero_ArmRight.traverse((child: Mesh) => {
        if (child.name === 'Ranger_ArmRight_1') {
          child.material = ghostMaterial({
            color: '#88ccff',
            glowStrength: 12.0,
            fresnelPower: 1.2,
          }).material
        }
      })
    }
  }, { immediate: true })
  return {
    rig: computed(() => nodes.value?.[rigKey.value]),
    animations: computed(() => state.value?.animations ?? []),
  }
}

const singleGltf = isModular ? undefined : useSingleGltfRig()

const rig = isModular
  ? useModularRig(() => entity.value?.appearance, useModularArmor(() => props.entityId)).rig
  : singleGltf!.rig

const { actions, currentAnimName, play, stop } = useCharacterAnimations(rig, rigSize.value, singleGltf?.animations)

function meleeAttack() {
  play(AnimationName.MELEE_1H_ATTACK_CHOP)
}

function lookAtPoint(point: Vector3) {
  if (!characterRef.value) return
  const pos = characterRef.value.position
  characterRef.value.rotation.y = Math.atan2(point.x - pos.x, point.z - pos.z)
}

const equipment = computed(() => gameStore.derivedEquipment(entity.value?.id ?? ''))
const maxArmor = computed(() => gameStore.derivedMaxArmor(props.entityId))
const { activeWeaponSlot } = useActionBar()
const isLeader = computed(() => gameStore.party.leader === props.entityId)
const effectiveWeaponSlot = computed<'mainHand' | 'offHand' | 'none' | undefined>(() => isLeader.value ? activeWeaponSlot.value : undefined)
useEquipment(rig, equipment, effectiveWeaponSlot)
useStatusEffectOverlay(rig, computed(() => props.entityId))
useStatusEffectParticles(rig, computed(() => props.entityId))
useStatusEffectAnimations(computed(() => props.entityId), play)

const { numbers, showDamage, removeNumber } = useDamageNumbers()
const { texts: statusTexts, removeText: removeStatusText } = useStatusEffectTexts(computed(() => props.entityId))

// Three.js Group ref - controller operates directly on this
const characterRef = ref<Group>()

// Sync position back to store only when movement ends
function syncToStore() {
  if (!characterRef.value) return
  const pos = characterRef.value.position
  const rot = characterRef.value.rotation
  gameStore.updateEntity(props.entityId, {
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: rot.x, y: rot.y, z: rot.z },
  })
}

const { moveTo, update, target, onArrive, cancelMovement } = useCharacterController(characterRef, { play }, {
  speed: 3,
})

// Sync to store when movement ends
onArrive(syncToStore)

// Sync moveTarget to store when target changes
watch(target, (newTarget) => {
  gameStore.updateEntity(props.entityId, {
    moveTarget: newTarget ? { x: newTarget.x, y: newTarget.y, z: newTarget.z } : null,
  })
}, { immediate: true })

// Initialize position from store once when characterRef is available
watch(characterRef, (group) => {
  if (group && entity.value) {
    const { position, rotation } = entity.value
    group.position.set(position.x, position.y, position.z)
    if (rotation) {
      group.rotation.set(rotation.x, rotation.y, rotation.z)
    }
  }
}, { immediate: true })

watch(rig, (rigValue) => {
  if (rigValue) {
    rigValue.traverse((child: Mesh) => {
      if(child.isMesh) {
        child.castShadow = true
      }
    })
  }
}, { immediate: true })

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => update(delta))

function handleContextMenu(event: TresPointerEvent) {
  event.nativeEvent.preventDefault()
  openContextMenu(
    props.entityId,
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  )
}

const isPlayable = computed(() => gameStore.selectedEntityId === props.entityId)
const { url: portrait } = usePortraitRenderer(() => props.entityId)
const isDead = computed(() => (entity.value?.hp ?? 1) <= 0 || !!entity.value?.dead)
const isHovering = ref(false)

watch(
  () => [isDead.value, Object.keys(actions).length] as const,
  ([dead, len]) => {
    if (!len || !dead) return
    cancelMovement()
    if (actions[AnimationName.DEATH_A_POSE]) {
      play(AnimationName.DEATH_A_POSE, { fadeTime: 0.3, once: true })
    }
  },
  { immediate: true },
)

function handlePointerEnter() {
  if (combatStore.isTargeting) {
    combatStore.hoverTarget(props.entityId)
    const entity = gameStore.getEntity(props.entityId)
    if (entity?.team === 'hostile') {
      isHovering.value = true
      if (rig.value) addToSelection(rig.value, 'hostile')
    }
    return
  }
  if (!isPlayable.value) {
    isHovering.value = true
    if (rig.value) addToSelection(rig.value, 'party')
  }
}

function handlePointerLeave() {
  if (combatStore.isTargeting) {
    combatStore.hoverTarget(null)
    isHovering.value = false
    if (rig.value) removeFromSelection(rig.value, 'hostile')
    return
  }
  isHovering.value = false
  if (rig.value && !isPlayable.value) {
    removeFromSelection(rig.value, 'party')
  }
}

function handleClick() {
  if (combatStore.isTargeting) {
    combatStore.confirmTarget(props.entityId)
  }
}

const BONE_NAMES: Record<string, string> = {
  mainHand: 'handslotr',
  offHand: 'handslotl',
}

const extraAttachments: Record<string, import('three').Object3D | null> = {}

function attachToHand(slot: 'mainHand' | 'offHand', object: import('three').Object3D) {
  const boneName = BONE_NAMES[slot]!
  const bone = rig.value?.getObjectByName(boneName)
  if (!bone) return
  detachFromHand(slot)
  bone.add(object)
  extraAttachments[slot] = object
}

function detachFromHand(slot: 'mainHand' | 'offHand') {
  const obj = extraAttachments[slot]
  if (!obj) return
  obj.parent?.remove(obj)
  extraAttachments[slot] = null
}

defineExpose({
  play,
  stop,
  currentAnimName,
  actions,
  AnimationName,
  moveTo,
  cancelMovement,
  onArrive,
  showDamage,
  meleeAttack,
  lookAt: lookAtPoint,
  attachToHand,
  detachFromHand,
})
</script>

<template>
  <TresGroup
    v-if="entity"
    ref="characterRef"
  >
    <primitive
      v-if="rig"
      :object="rig"

      @contextmenu="handleContextMenu"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
      @click="handleClick"
    >
      <Html
        
        center
        :position="[0, 3, 0]"
      >
        <UApp>
          <Nameplate
            v-if="isDead || (isHovering && !isPlayable)"
            :name="entity.name"
            :portrait="portrait"
            :team="entity.team"
            :level="entity.level"
            :race="entity.race"
            :hp="entity.hp"
            :max-hp="entity.maxHp"
            :physical-armor="entity.physicalArmor"
            :max-physical-armor="maxArmor.physical"
            :magical-armor="entity.magicalArmor"
            :max-magical-armor="maxArmor.magical"
            :status-effects="entity.statusEffects"
          />
        </UApp>
        
      </Html>
      <DamageNumber
        v-for="entry in numbers"
        :key="entry.id"
        :entry="entry"
        @done="removeNumber(entry.id)"
      />
      <StatusEffectText
        v-for="entry in statusTexts"
        :key="entry.id"
        :entry="entry"
        @done="removeStatusText(entry.id)"
      />
    </primitive>

  </TresGroup>
</template>
