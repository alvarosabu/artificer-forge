<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch, watchEffect } from 'vue'
import { EquirectangularReflectionMapping, SRGBColorSpace, type Texture, TextureLoader } from 'three'
import { useTresContext } from '@tresjs/core'
import { PORTRAIT_RENDERING, type PortraitFraming } from '../../portrait/portraitRigPresets'

// A flat backdrop behind the subject. Rendered as a child of the portrait camera,
// so its position is camera-local: a plane at -Z always faces the lens and fills
// the frame, regardless of how the camera was orbited/framed for the character.
const props = withDefaults(defineProps<{
  framing: PortraitFraming
  src: string
  /** scene.environment bounce strength; lab overrides it for live tuning. */
  envIntensity?: number
}>(), { envIntensity: PORTRAIT_RENDERING.environmentIntensity })

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
// The backdrop doubles as scene.environment, so the subject picks up its colors
// as ambient bounce — the Blender-GI look of the authored portraits (red backdrop
// = red-tinted shadow side). A flat image as equirect is geometrically wrong, but
// at low intensity it only reads as a soft color cast.
const { scene } = useTresContext()
const envTexture = shallowRef<Texture>()
watch(texture, (tex) => {
  envTexture.value?.dispose()
  envTexture.value = undefined
  if (tex) {
    const env = tex.clone()
    env.mapping = EquirectangularReflectionMapping
    env.needsUpdate = true
    envTexture.value = env
  }
  scene.value.environment = envTexture.value ?? null
})

watchEffect(() => {
  scene.value.environmentIntensity = props.envIntensity
})

onScopeDispose(() => {
  scene.value.environment = null
  envTexture.value?.dispose()
  texture.value?.dispose()
})

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
