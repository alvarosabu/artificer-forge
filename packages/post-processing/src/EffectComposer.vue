<script setup lang="ts">
import { shallowRef, watch, onUnmounted, toValue } from 'vue'
import { useTresContext } from '@tresjs/core'
import type { Scene, Camera, Object3D } from 'three'
import { Color, RenderPipeline, WebGPURenderer } from 'three/webgpu'
import { NoToneMapping } from 'three'
import { pass, float, uniform, renderOutput } from 'three/tsl'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { useOutlinePass } from './useOutlinePass'

export interface OutlinePreset {
  visibleEdgeColor?: string
  hiddenEdgeColor?: string
  edgeStrength?: number
  edgeThickness?: number
  edgeGlow?: number
}

export interface BloomConfig {
  strength?: number
  radius?: number
  threshold?: number
  smoothWidth?: number
}

const props = withDefaults(defineProps<{
  outlinePresets?: Record<string, OutlinePreset>
  bloom?: BloomConfig
}>(), {
  outlinePresets: () => ({
    default: {},
  }),
})

const { renderer, scene, camera } = useTresContext()
const { getGroup } = useOutlinePass()

const postProcessing = shallowRef<RenderPipeline | null>(null)

watch(
  [scene, camera.activeCamera],
  ([currentScene, currentCamera]) => {
    if (!currentScene || !currentCamera) return
    if (postProcessing.value) return

    const webgpuRenderer = renderer.instance as unknown as WebGPURenderer
    const sceneObj = currentScene as unknown as Scene
    const cameraObj = currentCamera as unknown as Camera

    const renderPipeline = new RenderPipeline(webgpuRenderer)
    const scenePass = pass(sceneObj, cameraObj)
    const scenePassColor = scenePass.getTextureNode('output')

    // Build one outline pass per preset and accumulate outline color
    let composedOutline: any = null

    for (const [name, preset] of Object.entries(props.outlinePresets)) {
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

    // Compose output: scene + outlines + bloom
    let outputNode = composedOutline ? composedOutline.add(scenePassColor) : scenePassColor

    if (props.bloom) {
      const bloomPass = bloom(scenePassColor)
      bloomPass.strength.value = props.bloom.strength ?? 0.5
      bloomPass.radius.value = props.bloom.radius ?? 0
      bloomPass.threshold.value = props.bloom.threshold ?? 0
      bloomPass.smoothWidth.value = props.bloom.smoothWidth ?? 0.01

      watch(
        () => props.bloom,
        (config) => {
          if (!config) return
          bloomPass.strength.value = config.strength ?? 0.5
          bloomPass.radius.value = config.radius ?? 0
          bloomPass.threshold.value = config.threshold ?? 0
          bloomPass.smoothWidth.value = config.smoothWidth ?? 0.01
        },
        { deep: true },
      )

      outputNode = outputNode.add(bloomPass)
    }

    // Apply tone mapping + color space at the end from the renderer settings
    const rendererToneMapping = webgpuRenderer.toneMapping
    if (rendererToneMapping !== NoToneMapping) {
      renderPipeline.outputColorTransform = false
      outputNode = renderOutput(outputNode, rendererToneMapping)
    }
    renderPipeline.outputNode = outputNode
    postProcessing.value = renderPipeline
    renderer.replaceRenderFunction((notifySuccess) => {
      renderPipeline.render()
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
