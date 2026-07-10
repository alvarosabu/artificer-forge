<script setup lang="ts">
import { computed, ref } from 'vue'
import { TresCanvas, type TresRendererSetupContext } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { WebGPURenderer } from 'three/webgpu'
import CharacterPreview from '../../../components/CharacterPreview.vue'
import ColorField from '../../../components/ColorField.vue'
import PartPicker from '../../../components/PartPicker.vue'
import ThumbStudio from '../../../components/ThumbStudio.vue'
import { useCharacterCustomization } from '../../../composables/useCharacterCustomization'
import type { EquipSlot } from '../../../composables/useCharacterCustomization'
import { customizationToTemplateYaml } from '../../../utils/customizationToTemplateYaml'
import { HEADS } from '../../../utils/characterParts'
import { forRaceSex, type Race } from '../../../utils/partManifest'

useHead({ title: 'Create Character — Lab' })

const { state, heads, hairOptions, beardOptions, eyebrowOptions, hornOptions } = useCharacterCustomization()

// The horn material is TSL (node-based), which only runs on WebGPURenderer.
// Same factory pattern as pages/shaders/*; falls back to a WebGL backend on
// browsers without WebGPU.
const createWebGPURenderer = (ctx: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    antialias: true,
  })
  renderer.shadowMap.enabled = true
  return renderer
}

interface TintEntry { id: string, label: string, map: string }
interface ItemTemplate {
  templateId: string
  name: string
  modular?: { hides: string[], assets?: Partial<Record<'M' | 'F' | 'any', string>> }
  texture?: { base: string, tints?: TintEntry[] }
}

// Equipped armor → { id, hides } descriptors. Coverage (which body segments each
// piece hides) is read from the item YAML's modular.hides; the mesh is preloaded
// by id in CharacterPreview.
const { data: modularItems } = await useAsyncData('modular-items', () =>
  queryCollection('entities').where('type', '=', 'item').all(),
)

const equippedSlots = computed(() =>
  (Object.entries(state.equipment) as [EquipSlot, string | null][])
    .flatMap(([slot, id]) => {
      if (!id) return []
      const item = (modularItems.value ?? []).find(i => i.templateId === id) as ItemTemplate | undefined
      return item ? [{ slot, item }] : []
    }),
)

// Nude preview passes no armor: CharacterPreview detaches the pieces and the
// coverage mask shrinks, so every body segment flips back visible.
// Sexed items resolve their fitted variant from modular.assets (item YAML is
// the source of truth), so switching body type re-dresses.
// Goblins preview bare regardless: all gear is fitted to the medium body and
// would deform on the small skeleton.
const noFittedGear = computed(() => state.race === 'goblin')
const armor = computed(() =>
  state.nude || noFittedGear.value
    ? []
    : equippedSlots.value.flatMap(({ slot, item }) => {
        const path = item.modular?.assets?.[state.sex] ?? item.modular?.assets?.any
        if (!item.modular || !path) return []
        const tintId = state.equipmentTint[slot]
        const tint = tintId ? item.texture?.tints?.find(t => t.id === tintId)?.map ?? null : null
        return [{ id: path.split('/').pop()!.replace(/\.glb$/, ''), path, hides: item.modular.hides, tint }]
      }),
)

const RACES = [
  { id: 'human', label: 'Human', enabled: true },
  { id: 'elf', label: 'Elf', enabled: true },
  { id: 'tiefling', label: 'Tiefling', enabled: true },
  { id: 'goblin', label: 'Goblin', enabled: true },
  { id: 'drow', label: 'Drow', enabled: false },
  { id: 'dwarf', label: 'Dwarf', enabled: false },
  { id: 'dragonborn', label: 'Dragonborn', enabled: false },
  { id: 'half-orc', label: 'Half-Orc', enabled: false },
]

const RACE_HINTS: Record<Race, string> = {
  human: 'The most common face in the realm — humans adapt to anything.',
  elf: 'Keen senses and keener memories — elves outlive the kingdoms they wander.',
  tiefling: 'Infernal blood runs warm — horns and crimson skin mark the bargain of an ancestor.',
  goblin: 'Small, quick and chronically underestimated — a goblin\'s grin means the plan already started.',
}

const PLAYABLE_RACES: Race[] = ['human', 'elf', 'tiefling', 'goblin']

function selectRace(id: string) {
  if ((PLAYABLE_RACES as string[]).includes(id)) state.race = id as Race
}

const HORN_PATTERNS = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'repeated', label: 'Ridged' },
  { id: 'solid', label: 'Solid' },
] as const

// Base head that hair/beard/eyebrow thumbnails sit on — the current selection,
// falling back to the race+sex default head.
const baseHeadId = computed(() =>
  state.head ?? forRaceSex(HEADS, state.race, state.sex)[0]?.id ?? HEADS[0]!.id,
)

const CAM_TARGET: [number, number, number] = [0, 1.5, 0]
const CAM_POS: [number, number, number] = [0, 1.5, 3.4]

// MeshToonMaterial is non-PBR (light multiplies directly), so the PBR-tuned
// intensities blow it out. Dim the rig when toon shading is on.
const ambientIntensity = computed(() => (state.toon ? 0.45 : 1.1))
const keyIntensity = computed(() => (state.toon ? 1.1 : 2))
const fillIntensity = computed(() => (state.toon ? 0.3 : 0.6))

// Export the current customization as a drop-in entity template
// (content/entities/characters/). toon/nude stay lab-only.
const characterName = ref('')

function downloadTemplate() {
  const { filename, yaml } = customizationToTemplateYaml(state, characterName.value)
  const url = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="creator">
    <TresCanvas
      clear-color="#0e1014"
      window-size
      shadows
      :renderer="createWebGPURenderer"
    >
      <TresPerspectiveCamera
        :position="CAM_POS"
        :look-at="CAM_TARGET"
        :fov="35"
      />
      <OrbitControls
        :target="CAM_TARGET"
        :min-distance="0.8"
        :max-distance="10"
      />
      <TresAmbientLight :intensity="ambientIntensity" />
      <TresDirectionalLight
        :position="[3, 5, 4]"
        :intensity="keyIntensity"
        cast-shadow
      />
      <TresDirectionalLight
        :position="[-3, 2, -2]"
        :intensity="fillIntensity"
      />
      <TresGridHelper :args="[8, 16, '#2a2f3a', '#1a1d24']" />
      <Suspense>
        <CharacterPreview
          :body="state.body"
          :armor="armor"
          :head="state.head"
          :hair="state.hair"
          :beard="state.beard"
          :eyebrows="state.eyebrows"
          :horns="state.horns"
          :skin-color="state.skinColor"
          :hair-color="state.hairColor"
          :horn-color-a="state.hornColorA"
          :horn-color-b="state.hornColorB"
          :horn-pattern="state.hornPattern"
          :horn-weight="state.hornWeight"
          :toon="state.toon"
          :skeleton="state.skeleton"
        />
      </Suspense>
    </TresCanvas>

    <!-- LEFT: race + body type -->
    <aside class="panel panel--left">
      <header class="panel-head">
        <p class="panel-eyebrow">Origin — Custom</p>
        <h1 class="panel-title">Create Character</h1>
      </header>

      <section class="panel-section">
        <h2 class="section-label">Race</h2>
        <div class="race-grid">
          <button
            v-for="race in RACES"
            :key="race.id"
            type="button"
            :disabled="!race.enabled"
            class="race-cell"
            :class="{ 'race-cell--active': state.race === race.id, 'race-cell--locked': !race.enabled }"
            @click="selectRace(race.id)"
          >
            <span>{{ race.label }}</span>
            <span v-if="!race.enabled" class="race-soon">soon</span>
          </button>
        </div>
        <p class="section-hint">{{ RACE_HINTS[state.race] }}</p>
      </section>

      <section class="panel-section">
        <h2 class="section-label">Body Type</h2>
        <div class="sex-toggle">
          <button
            type="button"
            class="sex-btn"
            :class="{ 'sex-btn--active': state.sex === 'M' }"
            @click="state.sex = 'M'"
          >
            Masculine
          </button>
          <button
            type="button"
            class="sex-btn"
            :class="{ 'sex-btn--active': state.sex === 'F' }"
            @click="state.sex = 'F'"
          >
            Feminine
          </button>
        </div>
      </section>
    </aside>

    <!-- RIGHT: appearance thumbnails + colors -->
    <aside class="panel panel--right">
      <h2 class="section-label section-label--wide">Appearance</h2>

      <PartPicker
        v-model="state.head"
        title="Head"
        part-slot="head"
        :parts="heads"
        :head-id="baseHeadId"
        default-open
      />
      <PartPicker
        v-model="state.hair"
        title="Hair"
        part-slot="hair"
        :parts="hairOptions"
        :head-id="baseHeadId"
        none-label="Bald"
      />
      <PartPicker
        v-if="state.sex === 'M'"
        v-model="state.beard"
        title="Beard"
        part-slot="beard"
        :parts="beardOptions"
        :head-id="baseHeadId"
        none-label="Clean-shaven"
      />
      <PartPicker
        v-model="state.eyebrows"
        title="Eyebrows"
        part-slot="eyebrows"
        :parts="eyebrowOptions"
        :head-id="baseHeadId"
        none-label="None"
      />
      <PartPicker
        v-if="state.race === 'tiefling'"
        v-model="state.horns"
        title="Horns"
        part-slot="horns"
        :parts="hornOptions"
        :head-id="baseHeadId"
        none-label="None"
        default-open
      />

      <!-- Tiefling-only: TSL horn material controls -->
      <section
        v-if="state.race === 'tiefling'"
        class="panel-section"
      >
        <h2 class="section-label">Horn Material</h2>
        <div class="pattern-toggle">
          <button
            v-for="p in HORN_PATTERNS"
            :key="p.id"
            type="button"
            class="sex-btn"
            :class="{ 'sex-btn--active': state.hornPattern === p.id }"
            @click="state.hornPattern = p.id"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="color-row horn-colors">
          <UPopover>
            <button type="button" class="swatch">
              <span class="swatch-chip" :style="{ background: state.hornColorA }" />
              <span>Horn A</span>
            </button>
            <template #content>
              <ColorField v-model="state.hornColorA" />
            </template>
          </UPopover>
          <UPopover v-if="state.hornPattern !== 'solid'">
            <button type="button" class="swatch">
              <span class="swatch-chip" :style="{ background: state.hornColorB }" />
              <span>Horn B</span>
            </button>
            <template #content>
              <ColorField v-model="state.hornColorB" />
            </template>
          </UPopover>
        </div>
        <label
          v-if="state.hornPattern !== 'solid'"
          class="weight-field"
        >
          <span class="weight-label">Color A weight</span>
          <input
            v-model.number="state.hornWeight"
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="weight-slider"
          >
        </label>
      </section>

      <section class="panel-section">
        <h2 class="section-label">Shading</h2>
        <button
          type="button"
          class="shade-toggle"
          :class="{ 'shade-toggle--active': state.toon }"
          @click="state.toon = !state.toon"
        >
          <span>Toon shader</span>
          <span class="shade-state">{{ state.toon ? 'On' : 'Off' }}</span>
        </button>
        <button
          type="button"
          class="shade-toggle"
          :class="{ 'shade-toggle--active': state.skeleton }"
          @click="state.skeleton = !state.skeleton"
        >
          <span>Show skeleton</span>
          <span class="shade-state">{{ state.skeleton ? 'On' : 'Off' }}</span>
        </button>
      </section>

      <section class="panel-section">
        <h2 class="section-label">Gear</h2>
        <button
          type="button"
          class="shade-toggle"
          :class="{ 'shade-toggle--active': state.nude }"
          :disabled="noFittedGear"
          @click="state.nude = !state.nude"
        >
          <span>Hide clothing</span>
          <span class="shade-state">{{ state.nude ? 'On' : 'Off' }}</span>
        </button>
        <p v-if="noFittedGear" class="section-hint">No goblin-fitted gear yet — previewing bare.</p>
      </section>

      <section class="panel-section colors">
        <h2 class="section-label">Colors</h2>
        <div class="color-row">
          <UPopover>
            <button type="button" class="swatch">
              <span class="swatch-chip" :style="{ background: state.skinColor }" />
              <span>Skin</span>
            </button>
            <template #content>
              <ColorField v-model="state.skinColor" />
            </template>
          </UPopover>

          <UPopover>
            <button type="button" class="swatch">
              <span class="swatch-chip" :style="{ background: state.hairColor }" />
              <span>Hair</span>
            </button>
            <template #content>
              <ColorField v-model="state.hairColor" />
            </template>
          </UPopover>
        </div>
      </section>

    </aside>

    <!-- BOTTOM: name + download as entity template YAML -->
    <div class="export-bar">
      <input
        v-model="characterName"
        type="text"
        class="export-name"
        placeholder="Character name"
        maxlength="40"
        @keyup.enter="downloadTemplate"
      >
      <button
        type="button"
        class="export-btn"
        @click="downloadTemplate"
      >
        Download Template
      </button>
    </div>

    <!-- Off-screen thumbnail baker (own GL context) -->
    <ThumbStudio />
  </div>
</template>

<style scoped>
.creator {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #0e1014;
}
.panel {
  position: absolute;
  top: 1.5rem;
  bottom: 1.5rem;
  width: 20rem;
  overflow-y: auto;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(197, 165, 96, 0.35);
  background: linear-gradient(180deg, rgba(20, 22, 28, 0.92), rgba(12, 13, 17, 0.94));
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  color: #e7e2d4;
}
.panel--left { left: 1.5rem; }
.panel--right { right: 1.5rem; }
.panel-head { text-align: center; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(197, 165, 96, 0.25); margin-bottom: 1rem; }
.panel-eyebrow { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #c5a560; }
.panel-title { font-size: 1.25rem; font-weight: 600; letter-spacing: 0.02em; }
.panel-section { margin-bottom: 1.1rem; }
.section-label { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: #c5a560; margin-bottom: 0.5rem; }
.section-label--wide { padding-bottom: 0.6rem; border-bottom: 1px solid rgba(197, 165, 96, 0.2); margin-bottom: 0.75rem; }
.section-hint { font-size: 0.72rem; line-height: 1.4; color: #9a958a; margin-top: 0.5rem; }
.race-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
.race-cell {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.15rem; padding: 0.5rem 0.25rem; border-radius: 0.4rem; font-size: 0.72rem;
  border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03); color: #cfcabb;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.race-cell--active { border-color: #c5a560; background: rgba(197, 165, 96, 0.12); color: #f4edd8; box-shadow: 0 0 0 1px rgba(197,165,96,0.4) inset; }
.race-cell--locked { opacity: 0.4; cursor: not-allowed; }
.race-soon { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.1em; color: #7d7869; }
.sex-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.sex-btn { padding: 0.45rem; border-radius: 0.4rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #cfcabb; cursor: pointer; }
.sex-btn--active { border-color: #c5a560; background: rgba(197,165,96,0.12); color: #f4edd8; }
.colors { margin-top: 1rem; }
.color-row { display: flex; gap: 0.6rem; }
.swatch { display: flex; align-items: center; gap: 0.45rem; padding: 0.4rem 0.7rem; border-radius: 0.4rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #e7e2d4; cursor: pointer; }
.swatch-chip { width: 1.1rem; height: 1.1rem; border-radius: 0.25rem; border: 1px solid rgba(255,255,255,0.25); }
.shade-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.4rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #e7e2d4; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.shade-toggle--active { border-color: #c5a560; background: rgba(197,165,96,0.14); color: #f4edd8; }
.shade-state { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #9a958a; }
.shade-toggle--active .shade-state { color: #c5a560; }
.pattern-toggle { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
.horn-colors { margin-top: 0.6rem; }
.weight-field { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.6rem; }
.weight-label { font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: #9a958a; }
.weight-slider { width: 100%; accent-color: #c5a560; }
.export-bar {
  position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 0.5rem; width: 16rem;
  padding: 0.75rem; border-radius: 0.75rem;
  border: 1px solid rgba(197, 165, 96, 0.35);
  background: linear-gradient(180deg, rgba(20, 22, 28, 0.92), rgba(12, 13, 17, 0.94));
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}
.export-name {
  padding: 0.45rem 0.7rem; border-radius: 0.4rem; font-size: 0.85rem; text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03); color: #e7e2d4;
}
.export-name::placeholder { color: #7d7869; }
.export-name:focus { outline: none; border-color: rgba(197, 165, 96, 0.6); }
.export-btn {
  padding: 0.55rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
  border: 1px solid #c5a560; background: rgba(197, 165, 96, 0.16); color: #f4edd8;
  transition: background 0.15s;
}
.export-btn:hover { background: rgba(197, 165, 96, 0.28); }
</style>
