<script setup lang="ts">
import { shallowRef, watch, onUnmounted, toValue, type WatchStopHandle } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import type { Scene, Camera, Object3D } from 'three'
import { Color, RenderPipeline, WebGPURenderer } from 'three/webgpu'
import { NoToneMapping, Vector3 } from 'three'
import { pass, float, uniform, renderOutput } from 'three/tsl'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import { scaledBloom } from './ScaledBloomNode'
import { scaledDof } from './ScaledDepthOfFieldNode'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { useOutlinePass } from './useOutlinePass'
import { useDofFocus } from './useDofFocus'

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
  /** Scale of the bloom mip chain. 1 = three's stock half-res chain, 0.5 = quarter res (default). */
  resolutionScale?: number
}

export interface DofConfig {
  /** Depth band (world units) around the focus plane before a fragment is fully blurred. */
  focalLength?: number
  /** Blur radius multiplier. 0 = no visible blur (the pass still runs). */
  bokehScale?: number
  /** Focus depth along the camera look direction, used when no focus target is registered. */
  focusDistance?: number
  /** Added to the focus target's origin on world Y (the character group's origin is at the feet). */
  focusHeight?: number
  /** Exponential smoothing rate for the tracked focus depth. Higher = snappier. */
  smoothing?: number
  /** Scale of the CoC + bokeh passes. 0.5 ~ three's stock half-res chain, 0.25 = quarter res (default). */
  resolutionScale?: number
}

/**
 * How the scene pass is anti-aliased.
 * - msaa: the pass target inherits the renderer's sample count (4x). Correct edges, but
 *   the HalfFloat MSAA target costs several ms at full res, and any depth consumer
 *   (DOF) forces a full-res multisampled depth resolve on top.
 * - fxaa: single-sample pass, FXAA at the very end of the chain on the display-referred image.
 * - none: single-sample pass, no anti-aliasing.
 */
export type AntialiasMode = 'msaa' | 'fxaa' | 'none'

const props = withDefaults(defineProps<{
  outlinePresets?: Record<string, OutlinePreset>
  bloom?: BloomConfig
  /** Depth of field. Pass undefined to leave the pass out of the pipeline entirely. */
  dof?: DofConfig
  antialias?: AntialiasMode
}>(), {
  outlinePresets: () => ({
    default: {},
  }),
  antialias: 'msaa',
})

const { renderer, scene, camera } = useTresContext()
const { getGroup } = useOutlinePass()
const dofFocus = useDofFocus()
const { onBeforeRender } = useLoop()

const postProcessing = shallowRef<RenderPipeline | null>(null)

// The pass graph is compiled once, so adding or removing DOF means a rebuild.
// Watchers created inside a build are stopped before the next one.
let buildWatchers: WatchStopHandle[] = []

const dofFocusDistance = uniform(10)
const dofFocalLength = uniform(4)
const dofBokehScale = uniform(2)

const targetWorld = new Vector3()
const camWorld = new Vector3()
const camForward = new Vector3()

// Focus depth is the distance along the camera axis, not the euclidean distance:
// the node compares against -viewZ, so distanceTo() drifts the focus off the
// target near the screen edges.
onBeforeRender(({ delta, camera: active }) => {
  if (!props.dof) return
  const cam = toValue(active)
  const target = dofFocus?.target.value
  let wanted = props.dof.focusDistance ?? 10
  if (cam && target) {
    target.getWorldPosition(targetWorld)
    targetWorld.y += props.dof.focusHeight ?? 1
    cam.getWorldPosition(camWorld)
    cam.getWorldDirection(camForward)
    wanted = targetWorld.sub(camWorld).dot(camForward)
  }
  const rate = props.dof.smoothing ?? 8
  dofFocusDistance.value += (wanted - dofFocusDistance.value) * (1 - Math.exp(-rate * delta))
})

function disposePipeline() {
  for (const stop of buildWatchers) stop()
  buildWatchers = []
  postProcessing.value?.dispose()
  postProcessing.value = null
}

function buildPipeline(sceneObj: Scene, cameraObj: Camera) {
  const webgpuRenderer = renderer.instance as unknown as WebGPURenderer

  const renderPipeline = new RenderPipeline(webgpuRenderer)
  // Without an explicit samples count the pass inherits the renderer's 4x MSAA,
  // paid on a HalfFloat target. See AntialiasMode.
  const scenePass = props.antialias === 'msaa' ? pass(sceneObj, cameraObj) : pass(sceneObj, cameraObj, { samples: 1 })
  const scenePassColor = scenePass.getTextureNode('output')

  // Build one outline pass per preset and accumulate outline color
  let composedOutline: any = null

//     for (const [name, preset] of Object.entries(props.outlinePresets)) {
//       const selectedObjectsArray: Object3D[] = []
// 
//       const edgeStrength = uniform(preset.edgeStrength ?? 3)
//       const visibleEdgeColor = uniform(new Color(preset.visibleEdgeColor ?? '#ffffff'))
//       const hiddenEdgeColor = uniform(new Color(preset.hiddenEdgeColor ?? '#4e3636'))
// 
//       const outlinePass = outline(sceneObj, cameraObj, {
//         selectedObjects: selectedObjectsArray,
//         edgeGlow: float(preset.edgeGlow ?? 0),
//         edgeThickness: float(preset.edgeThickness ?? 1),
//       })
// 
//       const { visibleEdge, hiddenEdge } = outlinePass
//       const outlineColor = visibleEdge.mul(visibleEdgeColor).add(hiddenEdge.mul(hiddenEdgeColor)).mul(edgeStrength)
// 
//       composedOutline = composedOutline ? composedOutline.add(outlineColor) : outlineColor
// 
//       // Watch group changes and sync to the pass's selectedObjects array
//       const groupRef = getGroup(name)
//       watch(
//         groupRef,
//         (newSelection) => {
//           selectedObjectsArray.length = 0
//           selectedObjectsArray.push(...newSelection)
//           outlinePass.selectedObjects = selectedObjectsArray
//         },
//         { immediate: true },
//       )
//     }

  // Compose output: scene -> dof -> outlines -> bloom. DOF runs on the raw scene
  // colour: blurring after bloom smears the glow across depth edges, and
  // outlines/bloom are screen-space overlays that should stay sharp.
  let sceneColor: any = scenePassColor

  if (props.dof) {
    dofFocalLength.value = props.dof.focalLength ?? 4
    dofBokehScale.value = props.dof.bokehScale ?? 2
    // getViewZNode reads the pass's own depth attachment: no extra scene render.
    const dofPass = scaledDof(scenePassColor, scenePass.getViewZNode(), dofFocusDistance, dofFocalLength, dofBokehScale, props.dof.resolutionScale ?? 0.25)
    sceneColor = dofPass

    buildWatchers.push(watch(
      () => props.dof,
      (config) => {
        if (!config) return
        dofFocalLength.value = config.focalLength ?? 4
        dofBokehScale.value = config.bokehScale ?? 2
        // Applied next frame: the node re-runs setSize from updateBefore every frame.
        dofPass.resolutionScale = config.resolutionScale ?? 0.25
      },
      { deep: true },
    ))
  }

  let outputNode = composedOutline ? composedOutline.add(sceneColor) : sceneColor

  if (props.bloom) {
    // Bloom keeps reading the unblurred scene so its threshold sees true highlights.
    const bloomPass = scaledBloom(scenePassColor)
    bloomPass.strength.value = props.bloom.strength ?? 0.5
    bloomPass.radius.value = props.bloom.radius ?? 0
    bloomPass.threshold.value = props.bloom.threshold ?? 0
    bloomPass.smoothWidth.value = props.bloom.smoothWidth ?? 0.01
    bloomPass.resolutionScale = props.bloom.resolutionScale ?? 0.5

    buildWatchers.push(watch(
      () => props.bloom,
      (config) => {
        if (!config) return
        bloomPass.strength.value = config.strength ?? 0.5
        bloomPass.radius.value = config.radius ?? 0
        bloomPass.threshold.value = config.threshold ?? 0
        bloomPass.smoothWidth.value = config.smoothWidth ?? 0.01
        // Applied next frame: BloomNode re-runs setSize from updateBefore every frame.
        bloomPass.resolutionScale = config.resolutionScale ?? 0.5
      },
      { deep: true },
    ))

    outputNode = outputNode.add(bloomPass)
  }

  // Apply tone mapping + color space at the end from the renderer settings.
  // FXAA has to see the display-referred image (it thresholds on perceived luma),
  // so with fxaa the output transform always moves into the graph, before it.
  const rendererToneMapping = webgpuRenderer.toneMapping
  const useFxaa = props.antialias === 'fxaa'
  if (rendererToneMapping !== NoToneMapping || useFxaa) {
    renderPipeline.outputColorTransform = false
    outputNode = renderOutput(outputNode, rendererToneMapping)
  }
  if (useFxaa) outputNode = fxaa(outputNode)
  renderPipeline.outputNode = outputNode
  postProcessing.value = renderPipeline
  // PERF TEST instrumentation — remove when done
  console.info('[EffectComposer] pipeline built (src)', { antialias: props.antialias, bloomScale: props.bloom?.resolutionScale ?? 0.5, dof: !!props.dof, dofScale: props.dof?.resolutionScale ?? 0.25, outline: 'disabled' })
  renderer.replaceRenderFunction((notifySuccess) => {
    renderPipeline.render()
    notifySuccess()
  })
}

// The anti-alias mode is fixed at first build. Materials that read scene depth
// (viewportDepthTexture, e.g. the water) cache a GPU depth copy with the sample
// count of the first scene pass and only recreate it on resize, so rebuilding
// the pass with a different sample count leaves them binding a mismatched
// texture and the frame goes black. A change needs a page reload.
watch(() => props.antialias, (mode, previous) => {
  if (postProcessing.value && mode !== previous) {
    console.warn(`[EffectComposer] antialias changed to "${mode}" after the pipeline was built; reload to apply.`)
  }
})

watch(
  [scene, camera.activeCamera, () => !!props.dof],
  ([currentScene, currentCamera, wantsDof], previous) => {
    if (!currentScene || !currentCamera) return
    // Build once; later scene/camera ref flips are ignored as before. Only a
    // DOF toggle tears the compiled graph down and rebuilds it.
    if (postProcessing.value && wantsDof === previous?.[2]) return
    disposePipeline()
    buildPipeline(currentScene as unknown as Scene, currentCamera as unknown as Camera)
  },
  { immediate: true },
)

onUnmounted(disposePipeline)
</script>

<template>
  <!-- Renderless component -->
</template>
