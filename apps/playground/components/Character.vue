<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import type { Group } from 'three'
import { useCharacterAnimations, AnimationName } from '~/composables/useCharacterAnimations'
import { useCharacterController } from '~/composables/useCharacterController'

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

const { actions, currentAnimName, play, stop } = useCharacterAnimations(rig)

const equipment = computed(() => entity.value?.equipment)
useEquipment(rig, equipment)
useStatusEffectOverlay(rig, computed(() => props.entityId))
useStatusEffectParticles(rig, computed(() => props.entityId))
useStatusEffectAnimations(computed(() => props.entityId), play)

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

const { moveTo, update, target, onArrive } = useCharacterController(characterRef, { play }, {
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
const isHovering = ref(false)

function handlePointerEnter() {
  if (!isPlayable.value) {
    isHovering.value = true
    if (rig.value) addToSelection(rig.value, 'party')
  }
}

function handlePointerLeave() {
  isHovering.value = false
  if (rig.value && !isPlayable.value) {
    removeFromSelection(rig.value, 'party')
  }
}

defineExpose({
  play,
  stop,
  currentAnimName,
  actions,
  AnimationName,
  moveTo,
  onArrive,
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
      cast-shadow
      receive-shadow
      @contextmenu="handleContextMenu"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
    >
      <Html
        v-if="isHovering && !isPlayable"
        center
        :position="[0, 3, 0]"
      >
        <Nameplate
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
