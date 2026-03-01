<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import { useCharacterAnimations } from '~/composables/useCharacterAnimations'
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

// Team-based nameplate color
const nameplateColor = computed(() => {
  switch (entity.value?.team) {
    case 'hostile': return 'text-red-400'
    case 'ally': return 'text-white'
    default: return 'text-white'
  }
})
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
          <span class="text-lg text-shadow-lg font-bold flex items-center justify-center gap-1" :class="nameplateColor">
            <UIcon v-if="entity.team === 'hostile'" name="ph:skull-fill" class="size-4 text-white drop-shadow-[0_0_2px_#dc2626]" />{{ entity.name }}
          </span>
          <p v-if="entity.level || entity.race" class="text-sm text-white/70 font-bold flex items-center justify-center gap-1">
            <span v-if="entity.level">Lv. {{ entity.level }}</span>

            <span v-if="entity.race">{{ entity.race }}</span>
          </p>
          <UProgress
            size="lg"
            :ui="{ base: 'bg-black' }"
            class="border border-3 border-black rounded-full"
            color="error"
            :model-value="entity.hp"
            :max="entity.maxHp"
          />
          <span class="-mt-[8px] text-xs text-shadow-lg/30 font-bold bg-black rounded-full px-1 py-0.5" :class="nameplateColor">{{ entity.hp }} / {{ entity.maxHp }}</span>
          <StatusEffectBadges
            v-if="entity.statusEffects?.length"
            :status-effects="entity.statusEffects"
            direction="row"
            class="mt-0.5"
          />
        </div>
      </Html>
    </primitive>
  </TresGroup>
</template>
