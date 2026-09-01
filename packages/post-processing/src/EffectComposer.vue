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
import { tiltShift } from './tiltShift'
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

export interface TiltShiftConfig {
  /** Screen height of the sharp line, 0 = bottom, 1 = top. */
  focusCenter?: number
  /** Half-height of the fully sharp band, in screen fractions. */
  bandWidth?: number
  /** Ramp length from sharp to fully blurred, in screen fractions. */
  feather?: number
  /** Blur radius multiplier. 0 = no visible blur (the pass still runs). */
  strength?: number
  /** Depth band (world units) around the focus depth that stays sharp inside the ramp. */
  focalRange?: number
  /** Focus depth along the camera look direction, used when no focus target is registered. */
  focusDistance?: number
  /** Added to the focus target's origin on world Y (the character group's origin is at the feet). */
  focusHeight?: number
  /** Exponential smoothing rate for the tracked focus depth. Higher = snappier. */
  smoothing?: number
  /** Kernel taps = 3 + 2·sigma. Baked into the shader: changing it rebuilds the pipeline. */
  sigma?: number
  /** Scale of the blur passes. The sharp band stays full-res regardless. */
  resolutionScale?: number
}

/**
 * msaa inherits the renderer's 4x samples on a HalfFloat target, and any depth
 * consumer (DOF) then forces a full-res multisampled depth resolve on top.
 */
export type AntialiasMode = 'msaa' | 'fxaa' | 'none'

const props = withDefaults(defineProps<{
  outlinePresets?: Record<string, OutlinePreset>
  bloom?: BloomConfig
  /** undefined leaves the DOF pass out of the graph entirely. */
  dof?: DofConfig
  /** undefined leaves the tilt-shift pass out of the graph. Wins over dof when both are set. */
  tiltShift?: TiltShiftConfig
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
let buildWatchers: WatchStopHandle[] = []

// Shared by DOF and tilt-shift: both read the same smoothed focus depth.
const dofFocusDistance = uniform(10)
const dofFocalLength = uniform(4)
const dofBokehScale = uniform(2)

const tiltFocusCenter = uniform(0.5)
const tiltBandWidth = uniform(0.1)
const tiltFeather = uniform(0.35)
const tiltStrength = uniform(1)
const tiltFocalRange = uniform(12)

const targetWorld = new Vector3()
const camWorld = new Vector3()
const camForward = new Vector3()

// Distance along the camera axis, not euclidean: the node compares against -viewZ,
// so distanceTo() drifts the focus off the target near the screen edges.
onBeforeRender(({ delta, camera: active }) => {
  const focusConfig = props.tiltShift ?? props.dof
  if (!focusConfig) return
  const cam = toValue(active)
  const target = dofFocus?.target.value
  let wanted = focusConfig.focusDistance ?? 10
  if (cam && target) {
    target.getWorldPosition(targetWorld)
    targetWorld.y += focusConfig.focusHeight ?? 1
    cam.getWorldPosition(camWorld)
    cam.getWorldDirection(camForward)
    wanted = targetWorld.sub(camWorld).dot(camForward)
  }
  const rate = focusConfig.smoothing ?? 8
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
  // Without explicit samples the pass inherits the renderer's 4x MSAA. See AntialiasMode.
  const scenePass = props.antialias === 'msaa' ? pass(sceneObj, cameraObj) : pass(sceneObj, cameraObj, { samples: 1 })
  const scenePassColor = scenePass.getTextureNode('output')

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

  // Order: scene -> blur (dof OR tilt-shift) -> outlines -> bloom. The blur reads the
  // raw scene only: after bloom it would smear the glow across depth edges, and the
  // overlays must stay sharp.
  let sceneColor: any = scenePassColor

  if (props.tiltShift && props.dof) {
    console.warn('[EffectComposer] dof and tiltShift are both set; they fight over the same blur budget, so tiltShift wins. Pass only one.')
  }

  if (props.tiltShift) {
    const config = props.tiltShift
    tiltFocusCenter.value = config.focusCenter ?? 0.5
    tiltBandWidth.value = config.bandWidth ?? 0.1
    tiltFeather.value = config.feather ?? 0.35
    tiltStrength.value = config.strength ?? 1
    tiltFocalRange.value = config.focalRange ?? 12
    const tiltPass = tiltShift(scenePassColor, scenePass.getViewZNode(), {
      focusCenter: tiltFocusCenter,
      bandWidth: tiltBandWidth,
      feather: tiltFeather,
      strength: tiltStrength,
      focusDistance: dofFocusDistance,
      focalRange: tiltFocalRange,
    }, { sigma: config.sigma ?? 8, resolutionScale: config.resolutionScale ?? 0.5 })
    sceneColor = tiltPass.node

    buildWatchers.push(watch(
      () => props.tiltShift,
      (next) => {
        if (!next) return
        tiltFocusCenter.value = next.focusCenter ?? 0.5
        tiltBandWidth.value = next.bandWidth ?? 0.1
        tiltFeather.value = next.feather ?? 0.35
        tiltStrength.value = next.strength ?? 1
        tiltFocalRange.value = next.focalRange ?? 12
        // Applied next frame: GaussianBlurNode re-runs setSize from updateBefore every frame.
        tiltPass.blur.resolutionScale = next.resolutionScale ?? 0.5
      },
      { deep: true },
    ))
  } else if (props.dof) {
    dofFocalLength.value = props.dof.focalLength ?? 4
    dofBokehScale.value = props.dof.bokehScale ?? 2
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

  // FXAA thresholds on perceived luma, so it must run after the output transform,
  // which then has to move into the graph.
  const rendererToneMapping = webgpuRenderer.toneMapping
  const useFxaa = props.antialias === 'fxaa'
  if (rendererToneMapping !== NoToneMapping || useFxaa) {
    renderPipeline.outputColorTransform = false
    outputNode = renderOutput(outputNode, rendererToneMapping)
  }
  if (useFxaa) outputNode = fxaa(outputNode)
  renderPipeline.outputNode = outputNode
  postProcessing.value = renderPipeline
  // PERF TEST instrumentation, remove when done
  console.info('[EffectComposer] pipeline built (src)', { antialias: props.antialias, bloomScale: props.bloom?.resolutionScale ?? 0.5, dof: !!props.dof, dofScale: props.dof?.resolutionScale ?? 0.25, tiltShift: !!props.tiltShift, outline: 'disabled' })
  renderer.replaceRenderFunction((notifySuccess) => {
    renderPipeline.render()
    notifySuccess()
  })
}

// Fixed at first build: depth readers (viewportDepthTexture, e.g. water) cache a depth
// copy at the first pass's sample count, so rebuilding with another count goes black.
watch(() => props.antialias, (mode, previous) => {
  if (postProcessing.value && mode !== previous) {
    console.warn(`[EffectComposer] antialias changed to "${mode}" after the pipeline was built; reload to apply.`)
  }
})

watch(
  [scene, camera.activeCamera, () => !!props.dof, () => !!props.tiltShift, () => props.tiltShift?.sigma],
  ([currentScene, currentCamera, ...passKeys], previous) => {
    if (!currentScene || !currentCamera) return
    // Scene/camera ref flips are ignored; only pass toggles rebuild the graph
    // (and tilt sigma, which is baked into the blur kernel).
    if (postProcessing.value && previous && passKeys.every((key, i) => key === previous[i + 2])) return
    disposePipeline()
    buildPipeline(currentScene as unknown as Scene, currentCamera as unknown as Camera)
  },
  { immediate: true },
)

onUnmounted(disposePipeline)
</script>

<template>
</template>
