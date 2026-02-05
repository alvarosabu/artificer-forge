<script setup lang="ts">
import type { Scene, Camera, Object3D } from 'three'
import { Color, PostProcessing, WebGPURenderer } from 'three/webgpu'
import { pass, float, uniform } from 'three/tsl'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'

export interface OutlinePreset {
  visibleEdgeColor?: string
  hiddenEdgeColor?: string
  edgeStrength?: number
  edgeThickness?: number
  edgeGlow?: number
}

const props = withDefaults(defineProps<{
  presets?: Record<string, OutlinePreset>
}>(), {
  presets: () => ({
    default: {},
  }),
})

const { renderer, scene, camera } = useTresContext()
const { getGroup } = useOutlinePass()

const postProcessing = shallowRef<PostProcessing | null>(null)

watch(
  [scene, camera.activeCamera],
  ([s, c]) => {
    if (!s || !c) return
    if (postProcessing.value) return

    const webgpuRenderer = renderer.instance as unknown as WebGPURenderer
    const sceneObj = s as unknown as Scene
    const cameraObj = c as unknown as Camera

    const pp = new PostProcessing(webgpuRenderer)
    const scenePass = pass(sceneObj, cameraObj)

    // Build one outline pass per preset and accumulate outline color
    let composedOutline: any = null

    for (const [name, preset] of Object.entries(props.presets)) {
      const selectedObjectsArray: Object3D[] = []

      const edgeStrength = uniform(preset.edgeStrength ?? 3)
      const visibleEdgeColor = uniform(new Color(preset.visibleEdgeColor ?? '#ffffff'))
      const hiddenEdgeColor = uniform(new Color(preset.hiddenEdgeColor ?? '#4e3636'))

      const outlinePass = outline(sceneObj, cameraObj, {
        selectedObjects: selectedObjectsArray,
        edgeGlow: float(preset.edgeGlow ?? 0),
        edgeThickness: float(preset.edgeThickness ?? 1),
      })

      const { visibleEdge, hiddenEdge } = outlinePass
      const outlineColor = visibleEdge.mul(visibleEdgeColor).add(hiddenEdge.mul(hiddenEdgeColor)).mul(edgeStrength)

      composedOutline = composedOutline ? composedOutline.add(outlineColor) : outlineColor

      // Watch group changes and sync to the pass's selectedObjects array
      const groupRef = getGroup(name)
      watch(
        groupRef,
        (newSelection) => {
          selectedObjectsArray.length = 0
          selectedObjectsArray.push(...newSelection)
          outlinePass.selectedObjects = selectedObjectsArray
        },
        { immediate: true },
      )
    }

    pp.outputNode = composedOutline ? composedOutline.add(scenePass) : scenePass
    postProcessing.value = pp
    renderer.replaceRenderFunction((notifySuccess) => {
      pp.render()
      notifySuccess()
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  postProcessing.value?.dispose()
})
</script>

<template>
  <!-- Renderless component -->
</template>
