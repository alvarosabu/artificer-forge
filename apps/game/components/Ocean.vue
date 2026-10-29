<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { sampleHeight, stylizedOutput, toonShoreFoam, type HeightField } from '@artificer-forge/engine/runtime'
import { cameraFar, cameraNear, cameraPosition, color, exp, positionGeometry, linearDepth, mix, mx_noise_float, mx_worley_noise_float, parallaxUV, positionWorld, screenUV, time, uv, vec3, vec4, viewportLinearDepth, viewportSharedTexture, modelPosition, varying, sin, smoothstep, step } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Color } from 'three'

const props = defineProps<{
  heightField: HeightField
}>()

// The camera sees up to 200 m (its far plane) from up to 30 m behind the player.
const RADIUS = 250
const playerPosition = usePlayerPosition()
const waves = useShoreWaves()

// Tuned in the panel on the island (2026-10-08).
const shore = useUniforms({
  // no sun glitter on this surface, so pure-ish white costs nothing
  foamColor: '#f6fcff',
  foamDepth: 0.48,
  foamLines: 2,
  foamWidth: 0.28,
  foamDrift: 0.16,
  foamEdge: 0.15,
  foamWobble: 0.3,
  /** noise cells per metre of the wobble. High values break the stripes into blobs */
  foamNoiseScale: 2.65,
}, 'foam')

// Same Beer-Lambert absorption as the playground water (engine waterMaterial.ts).
// The ocean writes no blue of its own: it reads the sea floor behind it and eats
// light per metre of water the view ray crosses. Shallows stay sand-coloured and
// deep water goes blue-green.
const water = useUniforms({
  /**
   * The colour the water EATS, not the colour it looks. Red-orange takes the red out
   * of the sand and keeps the green, so the shallows go green-teal.
   */
  absorption: '#ff5900',
  /** how hard absorption bites per metre of water travelled */
  absorbStrength: 0.22,
  /** metres of water after which the colour stops deepening */
  maxDepth: 8,
  /** brightness of the caustic light on the sea floor */
  caustics: 0.57,
  /** Cells per TILE, not per metre. */
  causticsScale: 2,
  seaFoamScale: 2,
  debugView: 0,
}, 'ocean')

// The shader was tuned on a 4 m wide disc. Dividing world metres by that tile keeps
// caustics and foam the same size in metres, and they stay put if the mesh moves.
const TILE = 4
const tiledUv = positionWorld.xz.div(TILE)

const toCamera = cameraPosition.sub(positionWorld).normalize()
// Not parallaxUV: it builds its tangent frame from uv, and the disc has no uv.
// On a flat surface, world x and z are that frame.
const depthUv = tiledUv.sub(toCamera.xz.mul(0.5))

const causticsUv = vec3(depthUv.mul(water.causticsScale), time.mul(0.3))
const causticsNoise = mx_worley_noise_float(causticsUv).pow3()

const foamUv = vec3(tiledUv.mul(water.seaFoamScale), time.mul(0.1))
const foamMask = mx_noise_float(foamUv).abs().step(0.05).oneMinus()
const foamColor = color(0xE5F7FF)

// The ocean is transparent, so it draws after the opaque pass and the depth buffer
// holds the sand or rock under each fragment. The gap between the two is the water
// depth. Anything that breaks the surface gets a rim, with no per-object setup.
const alongRay = viewportLinearDepth.sub(linearDepth()).mul(cameraFar.sub(cameraNear)).max(0)
// The gap is measured along the view ray, and a low camera crosses more water for the
// same drop. The ray's vertical part converts it to metres down, or the band gets
// wider as the camera goes lower.
const waterDepth = alongRay.mul(cameraPosition.sub(positionWorld).normalize().y.abs())

// Signed noise, so the band moves both up and down the beach. Without it the
// stripes are exact contour lines of the sea floor.
const wobble = mx_noise_float(vec3(positionWorld.xz.mul(shore.foamNoiseScale), time.mul(0.25)))
  .mul(shore.foamWobble)
const shoreMask = toonShoreFoam(waterDepth.add(wobble).max(0), shore)

const edgeFade = positionGeometry.xz.length().smoothstep(RADIUS, RADIUS * 0.84)

// detailFar is read once: raising it later leaves waves on the coarse outer band
const geometry = createOceanGeometry({ minStep: 0.5, detailRadius: waves.detailFar.value, radius: RADIUS, segments: 96 })

const grading = useGrading()
const backdrop = viewportSharedTexture(screenUV).rgb
// alongRay, not waterDepth: light crosses the water along the view ray, so a low
// camera sees more of it, like a real sea
const transmission = exp(water.absorption.mul(water.absorbStrength).mul(alongRay.min(water.maxDepth)).negate())
// caustics are light ON the sea floor, so they fade with the floor as the water deepens
const causticsLight = color(0x11EEFF).mul(causticsNoise).mul(water.caustics)
// NOT a fog toward fogColor: the backdrop already carries the island's fog, so fogging
// again would haze the sea faster than the island. Converging to the backdrop lands on
// the correctly fogged pixel instead.
const seaFloor = mix(backdrop.add(causticsLight).mul(transmission), backdrop, grading.fogStrength)

const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false})
const worldXZ = positionGeometry.xz.add(modelPosition.xz)
const seaDepth = sampleHeight(props.heightField, worldXZ).negate()

const phase = wavePhase(waves, seaDepth)
// The disc is centred on the player, so the raw vertex position is the offset from the player
const amplitude = waveAmplitude(waves, seaDepth, positionGeometry.xz.length())
const lift = sin(phase).mul(amplitude)
material.positionNode = positionGeometry.add(vec3(0, lift, 0))

// Crest to trough is twice the amplitude. The 5 cm floor makes the thin sheet on the sand
// always count as broken.
const heightToDepth = varying(amplitude.mul(2).div(seaDepth.max(0.05)))
const breaking = step(waves.breakRatio, heightToDepth)
// sin(phase) is 1 on a crest and -1 in a trough
const onCrest = step(waves.crestFoam.mul(2).oneMinus(), varying(sin(phase)))
const crestMask = onCrest.mul(breaking)

// The foam has its own colour, so it is graded like the island: day-cycle light
// and fog. No core shadows: the plane faces straight up.
const whiteFoam = shoreMask.max(crestMask)
const foam = whiteFoam.max(foamMask)
const foamLit = stylizedOutput(mix(foamColor, shore.foamColor, whiteFoam), grading, { hasCoreShadows: false })
const seaColor = vec4(mix(seaFloor, foamLit.rgb, foam), edgeFade)

// Debug view: the lift as grey, black in a trough and white on a crest.
const heightView = vec4(vec3(varying(lift).div(waves.height).mul(0.5).add(0.5).saturate()), 1)
const crestTint = varying(lift).div(waves.height).mul(waves.crestLight).add(1)

material.outputNode = vec4(mix(seaFloor.mul(crestTint), foamLit.rgb, foam), edgeFade)

const uuid = inject<string>('uuid')
const hex = (u: { value: Color }) => `#${u.value.getHexString()}`
const { foamColor: foamColorControl, foamDepth, foamEdge, foamLines, foamWidth, foamDrift, foamWobble, foamNoise } = useControls('🫧 foam', {
  color: { value: hex(shore.foamColor), type: 'color' },
  depth: { value: shore.foamDepth.value, min: 0.05, max: 4, step: 0.01, type: 'range' },
  edge: { value: shore.foamEdge.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  lines: { value: shore.foamLines.value, min: 1, max: 12, step: 1, type: 'range' },
  width: { value: shore.foamWidth.value, min: 0.02, max: 1, step: 0.01, type: 'range' },
  drift: { value: shore.foamDrift.value, min: 0, max: 2, step: 0.01, type: 'range' },
  wobble: { value: shore.foamWobble.value, min: 0, max: 1, step: 0.01, type: 'range' },
  noise: { value: shore.foamNoiseScale.value, min: 0.05, max: 3, step: 0.01, type: 'range' },
}, { uuid })

const { waterAbsorption, waterStrength, waterMaxDepth, waterCaustics, waterCausticsScale, waterFoamScale } = useControls('🌊 water', {
  absorption: { value: hex(water.absorption), type: 'color' },
  strength: { value: water.absorbStrength.value, min: 0, max: 3, step: 0.01, type: 'range' },
  maxDepth: { value: water.maxDepth.value, min: 0.5, max: 20, step: 0.1, type: 'range' },
  caustics: { value: water.caustics.value, min: 0, max: 1, step: 0.01, type: 'range' },
  causticsScale: { value: water.causticsScale.value, min: 0.5, max: 20, step: 0.1, type: 'range' },
  foamScale: { value: water.seaFoamScale.value, min: 0.5, max: 20, step: 0.1, type: 'range' },
}, { uuid })

const { wavesHeight, wavesFrequency, wavesPeriod, wavesBreakRatio, wavesCrestFoam, wavesDryTime, wavesWetStrength, wavesDebug } = useControls('🏄 waves', {
  height: { value: waves.height.value, min: 0, max: 1, step: 0.01, type: 'range' },
  frequency: { value: waves.frequency.value, min: 0.1, max: 20, step: 0.1, type: 'range' },
  period: { value: waves.period.value, min: 0.5, max: 12, step: 0.1, type: 'range' },
  breakRatio: { value: waves.breakRatio.value, min: 0.1, max: 2, step: 0.01, type: 'range' },
  crestFoam: { value: waves.crestFoam.value, min: 0, max: 0.5, step: 0.01, type: 'range' },
  dryTime: { value: waves.dryTime.value, min: 0.1, max: 20, step: 0.1, type: 'range' },
  wetStrength: { value: waves.wetStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
  debug: false,
}, { uuid })

// The uniforms exist already, so these calls only keep them in sync with the panel
useUniforms({
  foamColor: foamColorControl!,
  foamDepth: foamDepth!,
  foamEdge: foamEdge!,
  foamLines: foamLines!,
  foamWidth: foamWidth!,
  foamDrift: foamDrift!,
  foamWobble: foamWobble!,
  foamNoiseScale: foamNoise!,
}, 'foam')
useUniforms({
  absorption: waterAbsorption!,
  absorbStrength: waterStrength!,
  maxDepth: waterMaxDepth!,
  caustics: waterCaustics!,
  causticsScale: waterCausticsScale!,
  seaFoamScale: waterFoamScale!,
  debugView: () => (wavesDebug!.value ? 1 : 0),
}, 'ocean')
useUniforms({
  height: wavesHeight!,
  frequency: wavesFrequency!,
  period: wavesPeriod!,
  breakRatio: wavesBreakRatio!,
  crestFoam: wavesCrestFoam!,
  dryTime: wavesDryTime!,
  wetStrength: wavesWetStrength!,
}, 'waves')
</script>

<template>
  <TresMesh
    name="ocean"
    :geometry="geometry"
    :material="material"
    :position="[playerPosition[0], 0, playerPosition[2]]"
  />
</template>
