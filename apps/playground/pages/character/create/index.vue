<script setup lang="ts">
import { computed, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import CharacterPreview from '../../../components/CharacterPreview.vue'
import ColorField from '../../../components/ColorField.vue'
import PartPicker from '../../../components/PartPicker.vue'
import ThumbStudio from '../../../components/ThumbStudio.vue'
import { AnimationName, createWebGPURenderer } from '@artificer-forge/engine/runtime'
import { useCharacterCustomization } from '../../../composables/useCharacterCustomization'
import { customizationToTemplateYaml } from '../../../utils/customizationToTemplateYaml'
import { HEADS } from '../../../utils/characterParts'
import { forRaceSex, type Race } from '../../../utils/partManifest'
import { fitsRig, type EquipSlot } from '../../../utils/gearDefaults'

useHead({ title: 'Create Character — Lab' })

const { state, heads, hairOptions, beardOptions, eyebrowOptions, hornOptions, accessoryOptions } = useCharacterCustomization()

interface TintEntry { id: string, label: string, map: string }
interface ItemTemplate {
  templateId: string
  name: string
  modular?: { hides: string[], assets?: Partial<Record<'M' | 'F' | 'any', string>>, rig?: 'medium' | 'small' }
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
// the source of truth), so switching body type re-dresses. Pieces skinned to
// another rig (fitsRig) are skipped — they'd deform on the wrong skeleton.
const armor = computed(() =>
  state.nude
    ? []
    : equippedSlots.value.flatMap(({ slot, item }) => {
        const path = item.modular?.assets?.[state.sex] ?? item.modular?.assets?.any
        if (!item.modular || !path || !fitsRig(item.modular, state.race)) return []
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

// Active/inactive styling for Nuxt UI toggle-style buttons.
// Idle buttons get .toggle-idle to match the PartPicker collapsible colors
// instead of the slate `neutral` palette.
function toggleProps(active: boolean) {
  return active
    ? { color: 'primary', variant: 'soft' } as const
    : { color: 'neutral', variant: 'outline', class: 'toggle-idle' } as const
}

// Preview-only: which clip the character performs in the viewport. Not part of
// the customization state — it never lands in the exported template.
const ANIMATION_OPTIONS = Object.values(AnimationName).sort()
const previewAnimation = ref<string>(AnimationName.IDLE_A)

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
  <!-- .dark scopes Nuxt UI variants to dark styling regardless of system color mode -->
  <div class="creator dark">
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
          :accessory="state.accessory"
          :horns="state.horns"
          :skin-color="state.skinColor"
          :hair-color="state.hairColor"
          :horn-color-a="state.hornColorA"
          :horn-color-b="state.hornColorB"
          :horn-pattern="state.hornPattern"
          :horn-weight="state.hornWeight"
          :toon="state.toon"
          :skeleton="state.skeleton"
          :animation="previewAnimation"
        />
      </Suspense>
    </TresCanvas>

    <!-- LEFT: race + body type -->
    <aside class="panel panel--left">
      <header class="panel-head">
        <p class="panel-eyebrow">Origin — Custom</p>
        <h1 class="panel-title">Create Character</h1>
      </header>

      <section>
        <h2 class="section-label">Race</h2>
        <div class="grid grid-cols-3 gap-1.5">
          <UButton
            v-for="race in RACES"
            :key="race.id"
            v-bind="toggleProps(state.race === race.id)"
            :disabled="!race.enabled"
            size="sm"
            class="flex-col justify-center gap-0.5 py-2 text-xs"
            @click="selectRace(race.id)"
          >
            {{ race.label }}
            <span v-if="!race.enabled" class="text-[0.55rem] uppercase tracking-widest opacity-60">soon</span>
          </UButton>
        </div>
        <p class="section-hint">{{ RACE_HINTS[state.race] }}</p>
      </section>

      <section>
        <h2 class="section-label">Body Type</h2>
        <UFieldGroup class="w-full">
          <UButton
            v-bind="toggleProps(state.sex === 'M')"
            block
            icon="i-lucide-mars"
            @click="state.sex = 'M'"
          >
            Masculine
          </UButton>
          <UButton
            v-bind="toggleProps(state.sex === 'F')"
            block
            icon="i-lucide-venus"
            @click="state.sex = 'F'"
          >
            Feminine
          </UButton>
        </UFieldGroup>
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
      <!-- Hidden while the race/sex combo has no accessories (a lone None tile is noise) -->
      <PartPicker
        v-if="accessoryOptions.length"
        v-model="state.accessory"
        title="Accessory"
        part-slot="accessory"
        :parts="accessoryOptions"
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
      <section v-if="state.race === 'tiefling'">
        <h2 class="section-label">Horn Material</h2>
        <UFieldGroup class="w-full">
          <UButton
            v-for="p in HORN_PATTERNS"
            :key="p.id"
            v-bind="toggleProps(state.hornPattern === p.id)"
            block
            @click="state.hornPattern = p.id"
          >
            {{ p.label }}
          </UButton>
        </UFieldGroup>
        <div class="flex gap-2 mt-2.5">
          <UPopover>
            <UButton color="neutral" variant="outline" class="toggle-idle">
              <span class="swatch-chip" :style="{ background: state.hornColorA }" />
              Horn A
            </UButton>
            <template #content>
              <ColorField v-model="state.hornColorA" />
            </template>
          </UPopover>
          <UPopover v-if="state.hornPattern !== 'solid'">
            <UButton color="neutral" variant="outline" class="toggle-idle">
              <span class="swatch-chip" :style="{ background: state.hornColorB }" />
              Horn B
            </UButton>
            <template #content>
              <ColorField v-model="state.hornColorB" />
            </template>
          </UPopover>
        </div>
        <div v-if="state.hornPattern !== 'solid'" class="mt-3">
          <p class="field-label">Color A weight</p>
          <USlider
            v-model="state.hornWeight"
            :min="0"
            :max="1"
            :step="0.01"
            size="sm"
          />
        </div>
      </section>

      <section>
        <h2 class="section-label">Animation</h2>
        <!-- Menu content teleports to <body>, escaping the page's `.dark` scope —
             re-apply it on the portal so the popup matches the panels. -->
        <USelectMenu
          v-model="previewAnimation"
          :items="ANIMATION_OPTIONS"
          :search-input="{ placeholder: 'Search animations…', icon: 'i-lucide-search' }"
          :ui="{ content: 'dark' }"
          icon="i-lucide-person-standing"
          color="neutral"
          variant="outline"
          class="w-full toggle-idle"
        />
      </section>

      <section>
        <h2 class="section-label">Display</h2>
        <div class="grid grid-cols-3 gap-1.5">
          <UButton
            v-bind="toggleProps(state.toon)"
            icon="i-lucide-paintbrush"
            class="flex-col justify-center gap-1 py-2.5 text-xs"
            @click="state.toon = !state.toon"
          >
            Toon
          </UButton>
          <UButton
            v-bind="toggleProps(state.skeleton)"
            icon="i-lucide-bone"
            class="flex-col justify-center gap-1 py-2.5 text-xs"
            @click="state.skeleton = !state.skeleton"
          >
            Skeleton
          </UButton>
          <UButton
            v-bind="toggleProps(state.nude)"
            icon="i-lucide-shirt"
            class="flex-col justify-center gap-1 py-2.5 text-xs"
            @click="state.nude = !state.nude"
          >
            No gear
          </UButton>
        </div>
      </section>

      <section>
        <h2 class="section-label">Colors</h2>
        <div class="flex gap-2">
          <UPopover>
            <UButton color="neutral" variant="outline" class="toggle-idle">
              <span class="swatch-chip" :style="{ background: state.skinColor }" />
              Skin
            </UButton>
            <template #content>
              <ColorField v-model="state.skinColor" />
            </template>
          </UPopover>

          <UPopover>
            <UButton color="neutral" variant="outline" class="toggle-idle">
              <span class="swatch-chip" :style="{ background: state.hairColor }" />
              Hair
            </UButton>
            <template #content>
              <ColorField v-model="state.hairColor" />
            </template>
          </UPopover>
        </div>
      </section>
    </aside>

    <!-- BOTTOM: name + download as entity template YAML -->
    <div class="export-bar">
      <UInput
        v-model="characterName"
        placeholder="Character name"
        maxlength="40"
        :ui="{ base: 'text-center' }"
        @keyup.enter="downloadTemplate"
      />
      <UButton
        block
        color="primary"
        variant="subtle"
        class="uppercase tracking-wider font-semibold"
        @click="downloadTemplate"
      >
        Download Template
      </UButton>
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(197, 165, 96, 0.35);
  background: linear-gradient(180deg, rgba(20, 22, 28, 0.92), rgba(12, 13, 17, 0.94));
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  color: #e7e2d4;
}
.panel > * { flex-shrink: 0; }
.panel--left { left: 1.5rem; }
.panel--right { right: 1.5rem; }
.panel-head { text-align: center; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(197, 165, 96, 0.25); }
.panel-eyebrow { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #c5a560; }
.panel-title { font-size: 1.25rem; font-weight: 600; letter-spacing: 0.02em; }
.section-label { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: #c5a560; margin-bottom: 0.5rem; }
.section-label--wide { padding-bottom: 0.6rem; border-bottom: 1px solid rgba(197, 165, 96, 0.2); margin-bottom: 0; }
.section-hint { font-size: 0.72rem; line-height: 1.4; color: #9a958a; margin-top: 0.5rem; }
.field-label { font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: #9a958a; margin-bottom: 0.4rem; }
.swatch-chip { width: 1.1rem; height: 1.1rem; border-radius: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.25); }
/* Idle toggle/swatch buttons: same gold-tinted surface as the PartPicker
   collapsibles, overriding the slate neutral outline variant (bg + ring).
   :deep() variant needed for USelectMenu, which forwards the class to its
   inner trigger where the scope attribute doesn't land. */
.toggle-idle,
:deep(.toggle-idle) {
  background-color: rgba(255, 255, 255, 0.02) !important;
  --tw-ring-color: rgba(197, 165, 96, 0.18) !important;
  color: #cfcabb !important;
}
.toggle-idle:hover:not(:disabled),
:deep(.toggle-idle:hover:not(:disabled)) {
  background-color: rgba(197, 165, 96, 0.08) !important;
  --tw-ring-color: rgba(197, 165, 96, 0.4) !important;
}
.export-bar {
  position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 0.5rem; width: 16rem;
  padding: 0.75rem; border-radius: 0.75rem;
  border: 1px solid rgba(197, 165, 96, 0.35);
  background: linear-gradient(180deg, rgba(20, 22, 28, 0.92), rgba(12, 13, 17, 0.94));
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}
</style>
