<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import { useCharacterAnimations } from '~/composables/useCharacterAnimations'
import { useNpcBehavior } from '~/composables/useNpcBehavior'

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

const { nodes } = useGLTF(modelPath.value)
const rig = computed(() => nodes.value?.Rig_Medium)

const { play } = useCharacterAnimations(rig)

const equipment = computed(() => entity.value?.equipment)
useEquipment(rig, equipment)

useNpcBehavior(entity, play)

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
    addToSelection(rig.value, 'character')
  }
}

function handlePointerLeave() {
  isHovering.value = false
  if (rig.value) {
    removeFromSelection(rig.value, 'character')
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
        <div v-if="isHovering" class="flex flex-col items-center gap-1 w-[150px] text-center font-serif">
          <span class="text-lg text-white text-shadow-lg font-bold">{{ entity.name }}</span>
          <UProgress
            size="lg"
            :ui="{ base: 'bg-black' }"
            class="border border-3 border-black rounded-full"
            color="error"
            :model-value="entity.hp"
            :max="entity.maxHp"
          />
          <span class="-mt-[8px] text-xs text-white text-shadow-lg/30 font-bold bg-black rounded-full px-1 py-0.5">{{ entity.hp }} / {{ entity.maxHp }}</span>
        </div>
      </Html>
    </primitive>
  </TresGroup>
</template>
