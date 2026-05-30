<script setup lang="ts">
import { SRGBColorSpace, type Texture, TextureLoader } from 'three'
import type { PortraitFraming } from '~/utils/portraitRigPresets'

// A flat backdrop behind the subject. Rendered as a child of the portrait camera,
// so its position is camera-local: a plane at -Z always faces the lens and fills
// the frame, regardless of how the camera was orbited/framed for the character.
const props = defineProps<{
  framing: PortraitFraming
  src: string
}>()

// Load imperatively (no Suspense): a late backdrop is harmless; it just pops in.
// MeshBasicMaterial is unlit, so the 3-point portrait lighting never tints it.
const loader = new TextureLoader()
const texture = shallowRef<Texture>()
watch(() => props.src, (src) => {
  texture.value?.dispose()
  texture.value = undefined
  if (!src) return
  loader.load(src, (tex) => {
    tex.colorSpace = SRGBColorSpace
    texture.value = tex
  })
}, { immediate: true })
onScopeDispose(() => texture.value?.dispose())

// Place the plane just beyond the subject and size it to fill the camera frustum
// at that depth, so it reads as a full-bleed backdrop with no visible edges.
const plane = computed(() => {
  const f = props.framing
  const dx = f.lookAt[0] - f.cameraPosition[0]
  const dy = f.lookAt[1] - f.cameraPosition[1]
  const dz = f.lookAt[2] - f.cameraPosition[2]
  // Distance camera -> subject; push the backdrop well behind it so the body never
  // clips through, then size to the vertical FOV at that depth (+ padding).
  const dist = Math.hypot(dx, dy, dz) || 1
  const depth = dist * 1.8
  const size = 2 * depth * Math.tan((f.fov * Math.PI) / 360) * 1.15
  return { depth, size }
})
</script>

<template>
  <TresMesh
    v-if="texture"
    :position="[0, 0, -plane.depth]"
  >
    <TresPlaneGeometry :args="[plane.size, plane.size]" />
    <TresMeshBasicMaterial
      :map="texture"
      :tone-mapped="false"
    />
  </TresMesh>
</template>
