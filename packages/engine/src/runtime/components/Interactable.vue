<script setup lang="ts">
import { computed, type Ref, ref } from 'vue'
import { useGLTF, Html, useBVH } from '@tresjs/cientos'
import { useGraph, useLoop, type TresObject3D, type TresPointerEvent } from '@tresjs/core'
import { MathUtils } from 'three'
import { useOutlinePass } from '@artificer-forge/post-processing'
import { useContextMenu } from '../useContextMenu'
import { useGameStore } from '../stores/game'

const { open: openContextMenu } = useContextMenu()
const { addToSelection, removeFromSelection } = useOutlinePass()

interface AnimationState {
  target: string
  rotation?: { x: number, y: number, z: number }
  position?: { x: number, y: number, z: number }
}

interface AnimationsConfig {
  default: string
  states: Record<string, AnimationState>
}

const props = withDefaults(defineProps<{
  entityId: string
  // BVH debug visualization — wired by the app (was Leches-backed in the playground).
  debug?: boolean
}>(), {
  debug: false,
})

const emit = defineEmits<{
  interact: [entityId: string]
}>()

const gameStore = useGameStore()
const entity = computed(() => gameStore.getEntity(props.entityId))
const modelPath = computed(() => entity.value?.model!)
const animations = computed(() => entity.value?.animations as AnimationsConfig | undefined)

const { state: model } = useGLTF(modelPath.value, {
  draco: true,
})
const scene = computed(() => model.value?.scene)

useBVH(() => scene.value, {
  debug: () => props.debug,
})

/* const { applyBVHWhenReady } = useBVH({
  enabled: true,
})

// Apply BVH when model loads
applyBVHWhenReady(() => model.value?.scene) */
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
  if (scene.value) {
    addToSelection(scene.value, 'interactive')
  }
}

function handlePointerLeave() {
  isHovering.value = false
  if (scene.value) {
    removeFromSelection(scene.value, 'interactive')
  }
}

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
      @contextmenu="handleContextMenu"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
    >
    <Html
        center
        :position="[0, 2, 0]"
      >
        <div class="flex flex-col items-center gap-1 w-[150px] text-center font-serif"  v-if="isHovering">
          <span class="text-lg text-white text-shadow-lg font-bold">{{ entity.name }}</span>
          <UProgress 
            size="lg"
            :ui="{
              base: 'bg-black',
              
            }"
            class="border border-3 border-black rounded-full" 
            color="error" 
            :model-value="entity.hp" :max="entity.maxHp" 
          />
          <span class="-mt-[8px] text-xs text-white text-shadow-lg/30 font-bold bg-black rounded-full px-1 py-0.5">{{ entity.hp }} / {{ entity.maxHp }}</span>
        </div>
      </Html>
    </primitive>
  </TresGroup>
  
</template>
