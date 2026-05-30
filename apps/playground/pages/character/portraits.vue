<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { useControls } from '@tresjs/leches'
import { frameFromHead, PORTRAIT_CAMERA, type Vec3 } from '~/utils/portraitRigPresets'
import { resolvePortraitBackground } from '~/utils/portraitBackgrounds'
import type { Equipment } from '~/stores/game'
import type { PerspectiveCamera } from 'three'

useHead({ title: 'Character Portraits — Lab' })

// `background` mirrors each character's authored YAML `portraitBackground`; an
// undefined one falls back to the shared default, same as the bake.
const CHARACTERS = [
  { label: 'Fenrath (Large)', model: '/models/characters/fenrath.glb', rig: 'Rig_Large', background: undefined },
  { label: 'Hero (Medium)', model: '/models/characters/hero.glb', rig: 'Rig_Medium', background: '/img/portraits/bgs/blue-storm.png' },
  { label: 'Zynrae (Medium)', model: '/models/characters/zynrae.glb', rig: 'Rig_Medium', background: undefined },
  { label: 'Orc Scout (Medium)', model: '/models/characters/orc.glb', rig: 'Rig_Medium', background: undefined },
]
const selected = ref(CHARACTERS[0]!)
const equipment: Equipment = {}

// Same per-character backdrop the bake uses, so the preview is WYSIWYG.
const bgSrc = computed(() => resolvePortraitBackground(selected.value.background))

// Live camera knobs. Tune these in the Leches panel, then copy the readout below
// into PORTRAIT_CAMERA in utils/portraitRigPresets.ts.
// NOTE: no folder name — a named folder renders COLLAPSED by default, which hides
// every control and makes the panel look empty/broken. Top-level = always visible.
const { headLift, viewHeight, fov, cameraHeightOffset, yaw } = useControls({
  yaw: { value: PORTRAIT_CAMERA.yaw, min: -90, max: 90, step: 1, type: 'range' },
  headLift: { value: PORTRAIT_CAMERA.headLift, min: -0.5, max: 1, step: 0.01, type: 'range' },
  viewHeight: { value: PORTRAIT_CAMERA.viewHeight, min: 0.5, max: 3, step: 0.01, type: 'range' },
  fov: { value: PORTRAIT_CAMERA.fov, min: 10, max: 70, step: 1, type: 'range' },
  cameraHeightOffset: { value: PORTRAIT_CAMERA.cameraHeightOffset, min: -1, max: 1, step: 0.01, type: 'range' },
})

// useControls refs are typed as possibly-undefined; fall back to the defaults.
const knobs = computed(() => ({
  headLift: Number(headLift?.value ?? PORTRAIT_CAMERA.headLift),
  viewHeight: Number(viewHeight?.value ?? PORTRAIT_CAMERA.viewHeight),
  fov: Number(fov?.value ?? PORTRAIT_CAMERA.fov),
  cameraHeightOffset: Number(cameraHeightOffset?.value ?? PORTRAIT_CAMERA.cameraHeightOffset),
  yaw: Number(yaw?.value ?? PORTRAIT_CAMERA.yaw),
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
}`)

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
          <option v-for="c in CHARACTERS" :key="c.model" :value="c">{{ c.label }}</option>
        </select>
      </label>
    </header>

    <div class="lab-views">
      <!-- Scene camera: orbit to inspect the model -->
      <section class="view">
        <span class="tag">Scene (orbit)</span>
        <TresCanvas clear-color="#10131c" :alpha="false">
          <TresPerspectiveCamera :position="[4, 3.5, 7]" :look-at="sceneTarget" :fov="40" />
          <OrbitControls :target="sceneTarget" />
          <PortraitLights />
          <TresGridHelper :args="[10, 10]" />
          <Suspense>
            <PortraitSubject
              :key="`scene-${selected.model}`"
              :descriptor="{ model: selected.model, rig: selected.rig, equipment }"
              :auto-capture="false"
            />
          </Suspense>
        </TresCanvas>
      </section>

      <!-- Portrait camera: exact WYSIWYG of the baked portrait -->
      <section class="view portrait">
        <span class="tag">Portrait (bake preview)</span>
        <TresCanvas clear-color="#10131c" :alpha="false">
          <TresPerspectiveCamera ref="portraitCamRef">
            <PortraitBackground
              v-if="bgSrc"
              :framing="portraitCam"
              :src="bgSrc"
            />
          </TresPerspectiveCamera>
          <PortraitLights />
          <Suspense>
            <PortraitSubject
              :key="`portrait-${selected.model}`"
              :descriptor="{ model: selected.model, rig: selected.rig, equipment }"
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
