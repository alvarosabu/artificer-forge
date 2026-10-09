<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { createFoamUniforms, stylizedOutput, toonShoreFoam } from '@artificer-forge/engine/runtime'
import { cameraFar, cameraNear, cameraPosition, color, exp, float, linearDepth, mix, mx_noise_float, mx_worley_noise_float, parallaxUV, positionWorld, screenUV, time, uniform, uv, vec3, vec4, viewportLinearDepth, viewportSharedTexture } from 'three/tsl'
import { Color, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Ref } from 'vue'

// Place it with `position` on the component: the attribute falls through to the mesh.
const props = defineProps<{
  /** Side of the square plane, in metres */
  size: number
}>()

// The shader was tuned on a 4 m wide disc. Scale uv to that tile so caustics
// and foam keep their size in metres, whatever the plane size.
const TILE = 4

const geometry = new PlaneGeometry(props.size, props.size, 1, 1)
geometry.rotateX(-Math.PI / 2)

const tiledUv = uv().mul(props.size / TILE)

// @types/three types parallaxUV as an untyped Node.
const depthUv = (parallaxUV(tiledUv, float(0.5)) as ReturnType<typeof uv>).xy
const causticsUv = vec3(depthUv.mul(6), time.mul(0.3))
const causticsNoise = mx_worley_noise_float(causticsUv).pow3()

const foamUv = vec3(tiledUv.mul(5), time.mul(0.1))
const foamMask = mx_noise_float(foamUv).abs().step(0.05).oneMinus()
const foamColor = color(0xE5F7FF)

// Tuned in the panel on the island (2026-10-08).
const shore = {
  ...createFoamUniforms(),
  // no sun glitter on this surface, so pure-ish white costs nothing
  foamColor: uniform(new Color('#f6fcff')),
  foamDepth: uniform(0.48),
  foamLines: uniform(2),
  foamWidth: uniform(0.28),
  foamDrift: uniform(0.16),
  foamEdge: uniform(0.15),
  foamWobble: uniform(0.3),
  /** noise cells per metre of the wobble. High values break the stripes into blobs */
  foamNoiseScale: uniform(2.65),
}

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

// Fade only over the last ~8% of the plane, so it has no hard border against the
// sky. A wider fade reached the island and let the sand show through the sea.
const edgeFade = uv().sub(0.5).length().smoothstep(0.5, 0.42)

// Same Beer-Lambert absorption as the playground water (engine waterMaterial.ts).
// The ocean writes no blue of its own: it reads the sea floor behind it and eats
// light per metre of water the view ray crosses. Shallows stay sand-coloured and
// deep water goes blue-green.
const water = {
  /**
   * The colour the water EATS, not the colour it looks. Orange takes the red out of
   * the sand and some of the green, which leaves it teal-blue. The playground's
   * redder #ff5a1e keeps all the green, and over this sand it reads green.
   */
  absorption: uniform(new Color('#ff9a40')),
  /** how hard absorption bites per metre of water travelled */
  absorbStrength: uniform(0.55),
  /** metres of water after which the colour stops deepening */
  maxDepth: uniform(8),
  /** brightness of the caustic light on the sea floor */
  caustics: uniform(0.25),
}

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

// The foam has its own colour, so it is graded like the island: day-cycle light
// and fog. No core shadows: the plane faces straight up.
const foam = shoreMask.max(foamMask)
const foamLit = stylizedOutput(mix(foamColor, shore.foamColor, shoreMask), grading, { hasCoreShadows: false })

const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
material.outputNode = vec4(mix(seaFloor, foamLit.rgb, foam), edgeFade)

const uuid = inject<string>('uuid')
const { foamColor: foamColorControl, foamDepth, foamEdge, foamLines, foamWidth, foamDrift, foamWobble, foamNoise } = useControls('🫧 foam', {
  color: { value: `#${shore.foamColor.value.getHexString()}`, type: 'color' },
  depth: { value: shore.foamDepth.value, min: 0.05, max: 4, step: 0.01, type: 'range' },
  edge: { value: shore.foamEdge.value, min: 0.01, max: 1, step: 0.01, type: 'range' },
  lines: { value: shore.foamLines.value, min: 1, max: 12, step: 1, type: 'range' },
  width: { value: shore.foamWidth.value, min: 0.02, max: 1, step: 0.01, type: 'range' },
  drift: { value: shore.foamDrift.value, min: 0, max: 2, step: 0.01, type: 'range' },
  wobble: { value: shore.foamWobble.value, min: 0, max: 1, step: 0.01, type: 'range' },
  noise: { value: shore.foamNoiseScale.value, min: 0.05, max: 3, step: 0.01, type: 'range' },
}, { uuid })

const { waterAbsorption, waterStrength, waterMaxDepth, waterCaustics } = useControls('🌊 water', {
  absorption: { value: `#${water.absorption.value.getHexString()}`, type: 'color' },
  strength: { value: water.absorbStrength.value, min: 0, max: 3, step: 0.01, type: 'range' },
  maxDepth: { value: water.maxDepth.value, min: 0.5, max: 20, step: 0.1, type: 'range' },
  caustics: { value: water.caustics.value, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

function bindColor(source: Ref<string>, target: { value: Color }) {
  watch(source, (hex) => { target.value.set(hex) })
}
function bindNumber(source: Ref<number>, target: { value: number }) {
  watch(source, (v) => { target.value = v })
}
bindColor(foamColorControl as Ref<string>, shore.foamColor)
bindNumber(foamDepth!, shore.foamDepth)
bindNumber(foamEdge!, shore.foamEdge)
bindNumber(foamLines!, shore.foamLines)
bindNumber(foamWidth!, shore.foamWidth)
bindNumber(foamDrift!, shore.foamDrift)
bindNumber(foamWobble!, shore.foamWobble)
bindNumber(foamNoise!, shore.foamNoiseScale)
bindColor(waterAbsorption as Ref<string>, water.absorption)
bindNumber(waterStrength!, water.absorbStrength)
bindNumber(waterMaxDepth!, water.maxDepth)
bindNumber(waterCaustics!, water.caustics)
</script>

<template>
  <TresMesh
    name="ocean"
    :geometry="geometry"
    :material="material"
  />
</template>
