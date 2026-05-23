<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import type { TresPointerEvent } from '@tresjs/core'
import type { EntityState } from '~/stores/game'

const props = defineProps<{
  item: EntityState
}>()

const { open: openContextMenu } = useContextMenu()

// Await the GLTF load so the parent <Suspense> resolves once the model is ready.
// Items have no rig — render the GLTF scene root directly.
const { nodes, execute } = useGLTF(props.item.model!, { draco: true })
await execute()

const root = computed(() => nodes.value?.Scene)

function handleContextMenu(event: TresPointerEvent) {
  event.nativeEvent.preventDefault()
  openContextMenu(
    props.item.id,
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  )
}
</script>

<template>
  <TresGroup
    :position="[item.position.x, item.position.y, item.position.z]"
    :name="item.id"
  >
    <primitive
      v-if="root"
      :object="root"
      @contextmenu="handleContextMenu"
    />
  </TresGroup>
</template>
