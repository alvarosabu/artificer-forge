<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { createGradingContext } from '@artificer-forge/engine/runtime'
import type { DirectionalLight } from 'three'
import type { DayCycleName } from '~/utils/dayCyclePresets'

// Owns the look of the world: grading uniforms, sky, sun + drop shadows and the
// day cycle. Children get the grading context through useGrading().
const uuid = inject<string>('uuid')

// Camera radius is 15–30 (CameraController), so fog ratio 0 starts near the
// focus and ratio 1 sits past the far framing edge.
const grading = createGradingContext({ sceneNear: 20, sceneFar: 60 })
provideGrading(grading)

const dayCycle = useDayCycle()

const { scene } = useTresContext()
watch(scene, (s) => {
  if (!s) return
  s.background = null // a texture background would fight the node
  s.backgroundNode = grading.fogColor // the sky is the fog gradient, so there is no horizon seam
}, { immediate: true })

const {
  dayCyclePreset,
  dayCycleAuto,
  dayCycleDuration,
  dayCycleOrbit,
  dayCycleTheta,
  dayCyclePhi,
  dayCycleThetaAmplitude,
  dayCyclePhiAmplitude,
} = useControls('🌤️ dayCycle', {
  preset: {
    value: 'day',
    options: [
      { text: '☀️ Day', alias: 'day', value: 'day' },
      { text: '🌆 Dusk', alias: 'dusk', value: 'dusk' },
      { text: '🌙 Night', alias: 'night', value: 'night' },
      { text: '🌅 Dawn', alias: 'dawn', value: 'dawn' },
    ],
  },
  auto: { value: dayCycle.auto.running, type: 'boolean' },
  duration: { value: dayCycle.auto.duration, min: 10, max: 600, step: 1, type: 'range' },
  orbit: { value: dayCycle.sun.orbit, type: 'boolean' },
  theta: { value: dayCycle.sun.theta, min: -Math.PI, max: Math.PI, step: 0.01, type: 'range' },
  phi: { value: dayCycle.sun.phi, min: 0.05, max: 1.45, step: 0.01, type: 'range' },
  thetaAmplitude: { value: dayCycle.sun.thetaAmplitude, min: 0, max: Math.PI, step: 0.01, type: 'range' },
  phiAmplitude: { value: dayCycle.sun.phiAmplitude, min: 0, max: Math.PI, step: 0.01, type: 'range' },
}, { uuid })

// useDayCycle reads sun/auto every tick, so plain mutation is enough
watch(dayCyclePreset!, name => dayCycle.transitionTo(name as DayCycleName))
watch(dayCycleAuto!, (v) => { dayCycle.auto.running = v })
watch(dayCycleDuration!, (v) => { dayCycle.auto.duration = v })
watch(dayCycleOrbit!, (v) => { dayCycle.sun.orbit = v })
watch(dayCycleTheta!, (v) => { dayCycle.sun.theta = v })
watch(dayCyclePhi!, (v) => { dayCycle.sun.phi = v })
watch(dayCycleThetaAmplitude!, (v) => { dayCycle.sun.thetaAmplitude = v })
watch(dayCyclePhiAmplitude!, (v) => { dayCycle.sun.phiAmplitude = v })

// Gradient shape is not per-preset, so these drive the uniforms directly;
// sync() only writes colors and near/far.
const { fogCenterX, fogCenterY, fogStart, fogEnd, fogSceneNear, fogSceneFar } = useControls('🌫️ fog', {
  centerX: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  centerY: { value: 0.5, min: 0, max: 1, step: 0.01, type: 'range' },
  start: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
  end: { value: 1, min: 0, max: 2, step: 0.01, type: 'range' },
  sceneNear: { value: grading.range.sceneNear, min: 0, max: 100, step: 0.5, type: 'range' },
  sceneFar: { value: grading.range.sceneFar, min: 1, max: 200, step: 0.5, type: 'range' },
}, { uuid })

watch(fogCenterX!, (v) => { grading.uniforms.radialCenter.value.x = v })
watch(fogCenterY!, (v) => { grading.uniforms.radialCenter.value.y = v })
watch(fogStart!, (v) => { grading.uniforms.radialStart.value = v })
watch(fogEnd!, (v) => { grading.uniforms.radialEnd.value = v })
watch(fogSceneNear!, (v) => { grading.range.sceneNear = v })
watch(fogSceneFar!, (v) => { grading.range.sceneFar = v })

// Ramp shape is not per-preset either. Defaults read from the uniforms so the
// panel cannot drift from the engine defaults.
const u = grading.uniforms
const { rampShadowLow, rampShadowHigh, rampMidLow, rampMidHigh, rampMidStrength, rampHardness } = useControls('🎨 ramp', {
  shadowLow: { value: u.shadowEdgeLow.value, min: -1, max: 1, step: 0.01, type: 'range' },
  shadowHigh: { value: u.shadowEdgeHigh.value, min: -1, max: 1, step: 0.01, type: 'range' },
  midLow: { value: u.midEdgeLow.value, min: -1, max: 1, step: 0.01, type: 'range' },
  midHigh: { value: u.midEdgeHigh.value, min: -1, max: 1, step: 0.01, type: 'range' },
  midStrength: { value: u.midStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
  hardness: { value: u.rampHardness.value, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watch(rampShadowLow!, (v) => { u.shadowEdgeLow.value = v })
watch(rampShadowHigh!, (v) => { u.shadowEdgeHigh.value = v })
watch(rampMidLow!, (v) => { u.midEdgeLow.value = v })
watch(rampMidHigh!, (v) => { u.midEdgeHigh.value = v })
watch(rampMidStrength!, (v) => { u.midStrength.value = v })
watch(rampHardness!, (v) => { u.rampHardness.value = v })

// Rim, specular and mid tone only show on materials built with hasRim /
// hasSpecular / hasMidTone.
const { toonRimStrength, toonRimPower, toonSpecStrength, toonSpecShininess, toonAoStrength } = useControls('✨ toon', {
  rimStrength: { value: u.rimStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
  rimPower: { value: u.rimPower.value, min: 0.5, max: 8, step: 0.1, type: 'range' },
  specStrength: { value: u.specStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
  specShininess: { value: u.specShininess.value, min: 2, max: 128, step: 1, type: 'range' },
  aoStrength: { value: u.aoStrength.value, min: 0, max: 1, step: 0.01, type: 'range' },
}, { uuid })

watch(toonRimStrength!, (v) => { u.rimStrength.value = v })
watch(toonRimPower!, (v) => { u.rimPower.value = v })
watch(toonSpecStrength!, (v) => { u.specStrength.value = v })
watch(toonSpecShininess!, (v) => { u.specShininess.value = v })
watch(toonAoStrength!, (v) => { u.aoStrength.value = v })

// Bruno's defaults. Direction is not tunable: it is locked to grading.lightDirection.
const { shadowsAmplitude, shadowsBias, shadowsNormalBias, shadowsRadius } = useControls('🌑 shadows', {
  amplitude: { value: 15, min: 1, max: 50, step: 0.5, type: 'range' },
  bias: { value: -0.001, min: -0.02, max: 0.02, step: 0.0001, type: 'range' },
  normalBias: { value: 0.1, min: -0.3, max: 0.3, step: 0.01, type: 'range' },
  radius: { value: 3, min: 0, max: 10, step: 0.1, type: 'range' },
}, { uuid })

// Graded materials discard lambert lighting, so the sun only exists to feed the
// shadow map. No ambient light: nothing in the game reads it.
const sunRef = shallowRef<DirectionalLight>()

function applyShadowConfig() {
  const light = sunRef.value
  if (!light) return
  const amplitude = toValue(shadowsAmplitude!)
  const cam = light.shadow.camera
  cam.top = amplitude
  cam.right = amplitude
  cam.bottom = -amplitude
  cam.left = -amplitude
  cam.near = 1
  cam.far = 60
  cam.updateProjectionMatrix()
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.bias = toValue(shadowsBias!)
  light.shadow.normalBias = toValue(shadowsNormalBias!)
  light.shadow.radius = toValue(shadowsRadius!)
}

watch([sunRef, shadowsAmplitude!, shadowsBias!, shadowsNormalBias!, shadowsRadius!], applyShadowConfig)

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  dayCycle.tick(delta)
  grading.sync(dayCycle.current)
  // The sun must aim exactly along lightDirection, or the drop shadows and the
  // finish's core shadow disagree. Distance 20 keeps the frustum (near 1, far 60)
  // around the origin; it does not follow the player yet.
  sunRef.value?.position.copy(dayCycle.current.lightDirection).multiplyScalar(-20)
})
</script>

<template>
  <TresDirectionalLight
    ref="sunRef"
    cast-shadow
  />
  <!-- slot prop is for engine components, which take grading as a prop -->
  <slot :grading="grading" />
</template>
