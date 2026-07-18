<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { useControls } from '@tresjs/leches'
import {
  type ArmorPiece,
  createWebGPURenderer,
  type Equipment,
  frameFromHead,
  PORTRAIT_CAMERA,
  PORTRAIT_LIGHTS,
  PORTRAIT_RENDERING,
  PortraitBackground,
  PortraitLights,
  PortraitSubject,
  resolvePortraitBackground,
  type Vec3,
} from '@artificer-forge/engine/runtime'
import type { CharacterAppearance } from '@artificer-forge/engine/core'
import type { PerspectiveCamera } from 'three'

useHead({ title: 'Character Portraits — Lab' })

interface LabCharacter {
  label: string
  rig: string
  background?: string
  model?: string
  appearance?: CharacterAppearance
  armor?: ArmorPiece[]
}

// `background` mirrors each character's authored YAML `portraitBackground`; an
// undefined one falls back to the shared default, same as the bake.
const CHARACTERS: LabCharacter[] = [
  { label: 'Fenrath (Large)', model: '/models/characters/fenrath.glb', rig: 'Rig_Large', background: undefined },
  { label: 'Hero (Medium)', model: '/models/characters/hero.glb', rig: 'Rig_Medium', background: '/img/portraits/bgs/blue-storm.png' },
  { label: 'Zynrae (Medium)', model: '/models/characters/zynrae.glb', rig: 'Rig_Medium', background: undefined },
  { label: 'Orc Scout (Medium)', model: '/models/characters/orc.glb', rig: 'Rig_Medium', background: undefined },
  {
    // Modular subject: no model URL. The lab has no game store, so this mirrors
    // cedric.yaml + his armor item YAMLs by hand — keep in sync when his recipe
    // or gear changes.
    label: 'Cedric (Modular)',
    rig: 'Rig_Medium',
    background: '/img/portraits/bgs/blue-storm.png',
    appearance: {
      body: 'HUM_M_MEDIUM_Body_A',
      head: 'HUM_M_Head_Cedric',
      hair: 'GEN_M_Hair_Long_A',
      beard: null,
      eyebrows: 'GEN_Eyebrows_Thin_A',
      horns: null,
      skinColor: '#eecbb0',
      hairColor: '#2c222b',
      segmentMaterials: [
        { segments: ['armR', 'handR'], material: 'ghost', params: { color: '#88ccff', glowStrength: 12, fresnelPower: 1.2 } },
      ],
    },
    armor: [
      { id: 'ARM_M_Cedric_Padded', path: '/models/characters/armors/ARM_M_Cedric_Padded.glb', hides: ['torso'] },
      { id: 'ARM_Cedric_Cloak', path: '/models/characters/armors/ARM_Cedric_Cloak.glb', hides: [] },
      { id: 'ARM_Cedric_Trousers', path: '/models/characters/trousers/ARM_Cedric_Trousers.glb', hides: ['hips', 'leg'] },
      { id: 'ARM_Cedric_Gauntlet', path: '/models/characters/gauntlets/ARM_Cedric_Gauntlet.glb', hides: ['armL'] },
      { id: 'ARM_Cedric_Boots', path: '/models/characters/boots/ARM_Cedric_Boots.glb', hides: ['foot'] },
    ],
  },
]
const selected = ref(CHARACTERS[0]!)
const equipment: Equipment = {}

// Same per-character backdrop the bake uses, so the preview is WYSIWYG.
const bgSrc = computed(() => resolvePortraitBackground(selected.value.background))

// Live camera knobs. Tune these in the Leches panel, then copy the readout below
// into PORTRAIT_CAMERA in utils/portraitRigPresets.ts.
// NOTE: no folder name — a named folder renders COLLAPSED by default, which hides
// every control and makes the panel look empty/broken. Top-level = always visible.
const { headLift, viewHeight, fov, cameraHeightOffset, yaw, exposure, keyLight, keyColor, fillLight, fillColor, rimLight, rimColor, bounceLight, envBounce } = useControls({
  yaw: { value: PORTRAIT_CAMERA.yaw, min: -90, max: 90, step: 1, type: 'range' },
  headLift: { value: PORTRAIT_CAMERA.headLift, min: -0.5, max: 1, step: 0.01, type: 'range' },
  viewHeight: { value: PORTRAIT_CAMERA.viewHeight, min: 0.5, max: 3, step: 0.01, type: 'range' },
  fov: { value: PORTRAIT_CAMERA.fov, min: 10, max: 70, step: 1, type: 'range' },
  cameraHeightOffset: { value: PORTRAIT_CAMERA.cameraHeightOffset, min: -1, max: 1, step: 0.01, type: 'range' },
  exposure: { value: PORTRAIT_RENDERING.toneMappingExposure, min: 0.4, max: 2.5, step: 0.05, type: 'range' },
  keyLight: { value: PORTRAIT_LIGHTS.key, min: 0, max: 6, step: 0.05, type: 'range' },
  keyColor: { value: PORTRAIT_LIGHTS.keyColor, type: 'color' },
  fillLight: { value: PORTRAIT_LIGHTS.fill, min: 0, max: 2, step: 0.05, type: 'range' },
  fillColor: { value: PORTRAIT_LIGHTS.fillColor, type: 'color' },
  rimLight: { value: PORTRAIT_LIGHTS.rim, min: 0, max: 5, step: 0.05, type: 'range' },
  rimColor: { value: PORTRAIT_LIGHTS.rimColor, type: 'color' },
  bounceLight: { value: PORTRAIT_LIGHTS.bounce, min: 0, max: 2, step: 0.05, type: 'range' },
  envBounce: { value: PORTRAIT_RENDERING.environmentIntensity, min: 0, max: 1.5, step: 0.05, type: 'range' },
})

// useControls refs are typed as possibly-undefined; fall back to the defaults.
const knobs = computed(() => ({
  headLift: Number(headLift?.value ?? PORTRAIT_CAMERA.headLift),
  viewHeight: Number(viewHeight?.value ?? PORTRAIT_CAMERA.viewHeight),
  fov: Number(fov?.value ?? PORTRAIT_CAMERA.fov),
  cameraHeightOffset: Number(cameraHeightOffset?.value ?? PORTRAIT_CAMERA.cameraHeightOffset),
  yaw: Number(yaw?.value ?? PORTRAIT_CAMERA.yaw),
}))

const look = computed(() => ({
  exposure: Number(exposure?.value ?? PORTRAIT_RENDERING.toneMappingExposure),
  key: Number(keyLight?.value ?? PORTRAIT_LIGHTS.key),
  keyColor: String(keyColor?.value ?? PORTRAIT_LIGHTS.keyColor),
  fill: Number(fillLight?.value ?? PORTRAIT_LIGHTS.fill),
  fillColor: String(fillColor?.value ?? PORTRAIT_LIGHTS.fillColor),
  rim: Number(rimLight?.value ?? PORTRAIT_LIGHTS.rim),
  rimColor: String(rimColor?.value ?? PORTRAIT_LIGHTS.rimColor),
  bounce: Number(bounceLight?.value ?? PORTRAIT_LIGHTS.bounce),
  env: Number(envBounce?.value ?? PORTRAIT_RENDERING.environmentIntensity),
}))

const bounds = ref<{ min: Vec3, max: Vec3 } | null>(null)
function onBounds(min: Vec3, max: Vec3) {
  bounds.value = { min, max }
}

const head = ref<{ pos: Vec3, scale: number } | null>(null)
function onHead(pos: Vec3, scale: number) {
  head.value = { pos, scale }
}
watch(selected, () => { bounds.value = null; head.value = null })

const portraitCam = computed(() => {
  if (!head.value) {
    return { cameraPosition: [0, 3, 6] as Vec3, lookAt: [0, 3, 0] as Vec3, fov: knobs.value.fov }
  }
  return frameFromHead(head.value.pos, head.value.scale, knobs.value)
})

// Drive the portrait camera imperatively. Tres does NOT re-apply `:look-at` when
// only `:position` changes reactively, so an orbited camera would keep facing
// dead-front. Setting position + lookAt together every time keeps it oriented.
const portraitCamRef = shallowRef<PerspectiveCamera>()
watchEffect(() => {
  const cam = portraitCamRef.value
  if (!cam) return
  const f = portraitCam.value
  cam.position.set(f.cameraPosition[0], f.cameraPosition[1], f.cameraPosition[2])
  cam.fov = f.fov
  cam.updateProjectionMatrix()
  cam.lookAt(f.lookAt[0], f.lookAt[1], f.lookAt[2])
})

const sceneTarget = computed<Vec3>(() => {
  if (!bounds.value) return [0, 2, 0]
  return [
    (bounds.value.min[0] + bounds.value.max[0]) / 2,
    (bounds.value.min[1] + bounds.value.max[1]) / 2,
    (bounds.value.min[2] + bounds.value.max[2]) / 2,
  ]
})

const snippet = computed(() => `const PORTRAIT_CAMERA = {
  headLift: ${knobs.value.headLift},
  viewHeight: ${knobs.value.viewHeight},
  fov: ${knobs.value.fov},
  cameraHeightOffset: ${knobs.value.cameraHeightOffset},
  yaw: ${knobs.value.yaw},
}
// PORTRAIT_RENDERING: toneMappingExposure: ${look.value.exposure}, environmentIntensity: ${look.value.env}
// PORTRAIT_LIGHTS: key: ${look.value.key}, keyColor: '${look.value.keyColor}', fill: ${look.value.fill}, fillColor: '${look.value.fillColor}',
//   rim: ${look.value.rim}, rimColor: '${look.value.rimColor}', bounce: ${look.value.bounce}`)

const copied = ref(false)
async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
  catch { /* clipboard unavailable */ }
}
</script>

<template>
  <div class="portrait-lab">
    <header class="lab-bar">
      <h1>Character Portraits — Lab</h1>
      <label>
        Character
        <select v-model="selected">
          <option v-for="c in CHARACTERS" :key="c.label" :value="c">{{ c.label }}</option>
        </select>
      </label>
    </header>

    <div class="lab-views">
      <!-- Scene camera: orbit to inspect the model -->
      <section class="view">
        <span class="tag">Scene (orbit)</span>
        <TresCanvas
          clear-color="#10131c"
          :alpha="false"
          :renderer="createWebGPURenderer"
          :tone-mapping="PORTRAIT_RENDERING.toneMapping"
          :tone-mapping-exposure="look.exposure"
          :shadows="PORTRAIT_RENDERING.shadows"
        >
          <TresPerspectiveCamera :position="[4, 3.5, 7]" :look-at="sceneTarget" :fov="40" />
          <OrbitControls :target="sceneTarget" />
          <PortraitLights
            :key-intensity="look.key"
            :key-color="look.keyColor"
            :fill-intensity="look.fill"
            :fill-color="look.fillColor"
            :rim-intensity="look.rim"
            :rim-color="look.rimColor"
            :bounce-intensity="look.bounce"
          />
          <TresGridHelper :args="[10, 10]" />
          <Suspense>
            <PortraitSubject
              :key="`scene-${selected.label}`"
              :descriptor="{ model: selected.model, appearance: selected.appearance, armor: selected.armor, rig: selected.rig, equipment }"
              :auto-capture="false"
            />
          </Suspense>
        </TresCanvas>
      </section>

      <!-- Portrait camera: exact WYSIWYG of the baked portrait -->
      <section class="view portrait">
        <span class="tag">Portrait (bake preview)</span>
        <TresCanvas
          clear-color="#10131c"
          :alpha="false"
          :renderer="createWebGPURenderer"
          :tone-mapping="PORTRAIT_RENDERING.toneMapping"
          :tone-mapping-exposure="look.exposure"
          :shadows="PORTRAIT_RENDERING.shadows"
        >
          <TresPerspectiveCamera ref="portraitCamRef">
            <PortraitBackground
              v-if="bgSrc"
              :framing="portraitCam"
              :src="bgSrc"
              :env-intensity="look.env"
            />
          </TresPerspectiveCamera>
          <PortraitLights
            :key-intensity="look.key"
            :key-color="look.keyColor"
            :fill-intensity="look.fill"
            :fill-color="look.fillColor"
            :rim-intensity="look.rim"
            :rim-color="look.rimColor"
            :bounce-intensity="look.bounce"
          />
          <Suspense>
            <PortraitSubject
              :key="`portrait-${selected.label}`"
              :descriptor="{ model: selected.model, appearance: selected.appearance, armor: selected.armor, rig: selected.rig, equipment }"
              :auto-capture="false"
              @bounds="onBounds"
              @head="onHead"
            />
          </Suspense>
        </TresCanvas>
      </section>
    </div>

    <footer class="lab-readout">
      <pre>{{ snippet }}</pre>
      <button type="button" @click="copySnippet">{{ copied ? 'Copied!' : 'Copy' }}</button>
      <p class="hint">
        Tune with the panel (top-right), then paste this into <code>PORTRAIT_CAMERA</code>
        in <code>utils/portraitRigPresets.ts</code>. Bump <code>PORTRAIT_CACHE_VERSION</code>
        to re-bake existing portraits.
      </p>
    </footer>

    <TresLeches />
  </div>
</template>

<style scoped>
.portrait-lab {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0c12;
  color: #e7e3d6;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.lab-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #2a2f3a;
}
.lab-bar h1 { font-size: 0.95rem; font-weight: 600; margin: 0; }
.lab-bar label { font-size: 0.8rem; display: inline-flex; gap: 0.4rem; align-items: center; }
.lab-bar select { background: #1a1f2b; color: inherit; border: 1px solid #3a4150; border-radius: 4px; padding: 2px 6px; }
.lab-views { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
.view { position: relative; min-height: 0; }
.view + .view { border-left: 1px solid #2a2f3a; }
.view.portrait { aspect-ratio: auto; }
.tag {
  position: absolute; z-index: 2; top: 8px; left: 8px;
  font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase;
  background: rgba(0,0,0,0.55); padding: 2px 8px; border-radius: 4px;
}
.lab-readout {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.6rem 1rem; border-top: 1px solid #2a2f3a; background: #0d1018;
}
.lab-readout pre { margin: 0; font-size: 0.72rem; color: #c8d2e0; white-space: pre; }
.lab-readout button {
  background: #c8922a; color: #1a1208; border: 0; border-radius: 4px;
  padding: 4px 12px; font-weight: 600; cursor: pointer;
}
.hint { font-size: 0.72rem; color: #8b93a3; margin: 0; }
.hint code { color: #c8922a; }
</style>
