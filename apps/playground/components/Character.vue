<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import type { Group } from 'three'
import { useCharacterAnimations, AnimationName } from '~/composables/useCharacterAnimations'
import { useCharacterController } from '~/composables/useCharacterController'

const props = withDefaults(defineProps<{
  entityId: string
}>(), {
  entityId: '',
})

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))
const modelPath = computed(() => entity.value?.model!)

const { nodes } = useGLTF(modelPath.value)
const rig = computed(() => nodes.value?.Rig_Medium)

const { actions, currentAnimName, play, stop } = useCharacterAnimations(rig)

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

const { moveTo, update } = useCharacterController(characterRef, { play }, {
  speed: 3,
  onFinishMovement: syncToStore,
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => update(delta))

defineExpose({
  play,
  stop,
  currentAnimName,
  actions,
  AnimationName,
  moveTo,
})
</script>

<template>
  <TresGroup
    v-if="entity"
    ref="characterRef"
    :position="[entity.position.x, entity.position.y, entity.position.z]"
    :rotation="[entity.rotation?.x ?? 0, entity.rotation?.y ?? 0, entity.rotation?.z ?? 0]"
  >
    <primitive
      v-if="rig"
      :object="rig"
      cast-shadow
      receive-shadow
    />
  </TresGroup>
</template>
