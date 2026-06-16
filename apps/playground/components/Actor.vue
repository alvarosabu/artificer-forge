<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import { useCharacterAnimations } from '@artificer-forge/engine/runtime'
import { useOutlinePass } from '@artificer-forge/post-processing'
import { useActorBehavior } from '~/composables/useActorBehavior'

const { open: openContextMenu } = useContextMenu()
const { addToSelection, removeFromSelection } = useOutlinePass()

const props = withDefaults(defineProps<{
  entityId: string
}>(), {
  entityId: '',
})

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))
const modelPath = computed(() => entity.value?.model!)

const { nodes } = useGLTF(modelPath.value, { draco: true })
const rig = computed(() => nodes.value?.Rig_Medium)

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
