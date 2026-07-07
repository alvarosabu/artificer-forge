<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import { useOutlinePass } from '@artificer-forge/post-processing'
import { useCharacterAnimations } from '../useCharacterAnimations'
import { useModularRig } from '../modular/useModularRig'
import { useModularArmor } from '../modular/useModularArmor'
import { useActorBehavior } from '../useActorBehavior'
import { useContextMenu } from '../useContextMenu'
import { useEquipment } from '../useEquipment'
import { useStatusEffectOverlay } from '../useStatusEffectOverlay'
import { useStatusEffectParticles } from '../useStatusEffectParticles'
import { useStatusEffectAnimations } from '../useStatusEffectAnimations'
import { usePortraitRenderer } from '../portrait/usePortraitRenderer'
import { useGameStore } from '../stores/game'
import Nameplate from './Nameplate.vue'

const { open: openContextMenu } = useContextMenu()
const { addToSelection, removeFromSelection } = useOutlinePass()

const props = withDefaults(defineProps<{
  entityId: string
}>(), {
  entityId: '',
})

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))

// Rig source is a setup-time decision: an entity is either modular (assembled
// from appearance parts) or single-GLB — it never switches.
const isModular = !!entity.value?.appearance

function useSingleGltfRig() {
  const { nodes } = useGLTF(entity.value?.model ?? '', { draco: true })
  return computed(() => nodes.value?.Rig_Medium)
}

const rig = isModular
  ? useModularRig(() => entity.value?.appearance, useModularArmor(() => props.entityId)).rig
  : useSingleGltfRig()

const { play } = useCharacterAnimations(rig)

const equipment = computed(() => gameStore.derivedEquipment(entity.value?.id ?? ''))
const maxArmor = computed(() => gameStore.derivedMaxArmor(props.entityId))
const { url: portrait } = usePortraitRenderer(() => props.entityId)
useEquipment(rig, equipment)
useStatusEffectOverlay(rig, computed(() => props.entityId))
useStatusEffectParticles(rig, computed(() => props.entityId))
useStatusEffectAnimations(computed(() => props.entityId), play)

useActorBehavior(entity, play)

function handleContextMenu(event: TresPointerEvent) {
  event.nativeEvent.preventDefault()
  openContextMenu(
    props.entityId,
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  )
}

const isDead = computed(() => (entity.value?.hp ?? 1) <= 0)
const isHovering = ref(false)

function handlePointerEnter() {
  isHovering.value = true
  if (rig.value) {
    addToSelection(rig.value, entity.value?.team ?? 'neutral')
  }
}

function handlePointerLeave() {
  isHovering.value = false
  if (rig.value) {
    removeFromSelection(rig.value, entity.value?.team ?? 'neutral')
  }
}

</script>

<template>
  <TresGroup
    v-if="entity"
    :position="[entity.position.x, entity.position.y, entity.position.z]"
    :rotation="[entity.rotation?.x ?? 0, entity.rotation?.y ?? 0, entity.rotation?.z ?? 0]"
  >
    <primitive
      v-if="rig"
      :object="rig"
      cast-shadow
      receive-shadow
      @contextmenu="handleContextMenu"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
    >
      <Html
        center

        :position="[0, 3, 0]"
      >
        <UApp>
          <Nameplate
            v-if="isDead || isHovering"
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
    </primitive>
  </TresGroup>
</template>
