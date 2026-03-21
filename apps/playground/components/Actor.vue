<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import { useCharacterAnimations } from '@artificer-forge/composables'
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

const equipment = computed(() => entity.value?.equipment)
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
        <Nameplate
          v-if="isHovering"
          :name="entity.name"
          :team="entity.team"
          :level="entity.level"
          :race="entity.race"
          :hp="entity.hp"
          :max-hp="entity.maxHp"
          :status-effects="entity.statusEffects"
        />
      </Html>
    </primitive>
  </TresGroup>
</template>
