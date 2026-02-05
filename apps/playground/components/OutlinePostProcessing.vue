<script setup lang="ts">
import type { Scene, Camera, Object3D } from 'three'
import { Color, PostProcessing, WebGPURenderer } from 'three/webgpu'
import { pass, float, uniform } from 'three/tsl'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'

const props = withDefaults(defineProps<{
  edgeGlow?: number
  edgeThickness?: number
  edgeStrength?: number
  visibleEdgeColor?: string
  hiddenEdgeColor?: string
}>(), {
  edgeGlow: 0,
  edgeThickness: 1,
  edgeStrength: 3,
  visibleEdgeColor: '#ffffff',
  hiddenEdgeColor: '#4e3636',
})

const { renderer, scene, camera } = useTresContext()
const { selectedObjects: outlineSelection } = useOutlinePass()

// Store references for cleanup
const postProcessing = shallowRef<PostProcessing | null>(null)
let outlinePass: ReturnType<typeof outline> | null = null
const selectedObjectsArray: Object3D[] = []

// Initialize post-processing when scene and camera are ready
watch(
  [scene, camera.activeCamera],
  ([s, c]) => {
    if (!s || !c) return
    if (postProcessing.value) return // Already initialized

    const webgpuRenderer = renderer.instance as unknown as WebGPURenderer
    const sceneObj = s as unknown as Scene
    const cameraObj = c as unknown as Camera

    const pp = new PostProcessing(webgpuRenderer)
    const scenePass = pass(sceneObj, cameraObj)

    const edgeStrength = uniform(props.edgeStrength)
    const visibleEdgeColor = uniform(new Color(props.visibleEdgeColor))
    const hiddenEdgeColor = uniform(new Color(props.hiddenEdgeColor))

    outlinePass = outline(sceneObj, cameraObj, {
      selectedObjects: selectedObjectsArray,
      edgeGlow: float(props.edgeGlow),
      edgeThickness: float(props.edgeThickness),
    })

    const { visibleEdge, hiddenEdge } = outlinePass
    const outlineColor = visibleEdge.mul(visibleEdgeColor).add(hiddenEdge.mul(hiddenEdgeColor)).mul(edgeStrength)

    pp.outputNode = outlineColor.add(scenePass)
    postProcessing.value = pp
    renderer.replaceRenderFunction((notifySuccess) => {
      pp.render()
      notifySuccess()
    })
  },
  { immediate: true }
)

// Update selected objects when selection changes
watch(
  outlineSelection,
  (newSelection) => {
    selectedObjectsArray.length = 0
    selectedObjectsArray.push(...newSelection)
    if (outlinePass) {
      outlinePass.selectedObjects = selectedObjectsArray
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  postProcessing.value?.dispose()
})
</script>

<template>
  <!-- Renderless component -->
</template>
