<script setup lang="ts">
import { useGLTF, Html } from '@tresjs/cientos'
import { useGraph, type TresObject3D } from '@tresjs/core'
import { MathUtils } from 'three'

interface AnimationState {
  target: string
  rotation?: { x: number, y: number, z: number }
  position?: { x: number, y: number, z: number }
}

interface AnimationsConfig {
  default: string
  states: Record<string, AnimationState>
}

const props = defineProps<{
  entityId: string
}>()

const emit = defineEmits<{
  interact: [entityId: string]
}>()

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))
const modelPath = computed(() => entity.value?.model!)
const animations = computed(() => entity.value?.animations as AnimationsConfig | undefined)

const { state } = useGLTF(modelPath.value, {
  draco: true,
})
const scene = computed(() => state.value?.scene)

// Get named nodes from the model
const graph = useGraph(scene as unknown as Ref<TresObject3D>)

// Find target mesh by name from animations config
const targetMesh = computed(() => {
  const animVal = animations.value
  if (!animVal?.states) return null

  const defaultState = animVal.states[animVal.default]
  const targetName = defaultState?.target
  if (!targetName) return null

  return graph.value?.nodes?.[targetName] ?? null
})

// Current animation state
const currentState = ref(animations.value?.default ?? 'closed')

// Target rotation (PI multipliers)
const targetRotation = computed(() => {
  const animVal = animations.value
  if (!animVal?.states) return { x: 0, y: 0, z: 0 }

  const stateConfig = animVal.states[currentState.value]
  if (!stateConfig?.rotation) return { x: 0, y: 0, z: 0 }

  return {
    x: stateConfig.rotation.x * Math.PI,
    y: stateConfig.rotation.y * Math.PI,
    z: stateConfig.rotation.z * Math.PI,
  }
})

// Lerp speed
const LERP_SPEED = 8

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const mesh = targetMesh.value
  if (!mesh) return

  mesh.rotation.x = MathUtils.lerp(
    mesh.rotation.x,
    targetRotation.value.x,
    delta * LERP_SPEED,
  )
  mesh.rotation.y = MathUtils.lerp(
    mesh.rotation.y,
    targetRotation.value.y,
    delta * LERP_SPEED,
  )
  mesh.rotation.z = MathUtils.lerp(
    mesh.rotation.z,
    targetRotation.value.z,
    delta * LERP_SPEED,
  )
})

function toggle() {
  const animVal = animations.value
  if (!animVal?.states) return

  const states = Object.keys(animVal.states)
  const currentIdx = states.indexOf(currentState.value)
  const nextIdx = (currentIdx + 1) % states.length
  currentState.value = states[nextIdx]!

  // Sync opened state to store
  gameStore.updateEntity(props.entityId, {
    opened: currentState.value === 'open',
  })
}

function handleClick() {
  emit('interact', props.entityId)
}

const isHovering = ref(false)

defineExpose({
  toggle,
})
</script>

<template>
  <TresGroup v-if="entity"  :position="[entity.position.x, entity.position.y, entity.position.z]">
    <primitive
      v-if="scene"
      :object="scene"
      @click="handleClick"
      @pointerenter="isHovering = true"
      @pointerleave="isHovering = false"
    >
    <Html
        center
        :distance-factor="8"
        :position="[0, 1.5, 0]"
      >
        <div class="flex flex-col items-center gap-1">
          <UBadge
            :label="entity.name"
            v-if="isHovering"
            size="xl"
            color="neutral"
            :variant="isHovering ? 'solid' : 'soft'"
          />
        </div>
      </Html>
    </primitive>
  </TresGroup>
  
</template>
