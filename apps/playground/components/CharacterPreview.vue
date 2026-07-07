<script setup lang="ts">
import { computed, reactive, watch, watchEffect } from 'vue'
import { useGLTF } from '@tresjs/cientos'
import { Color, DataTexture, Group, MeshToonMaterial, NearestFilter, RedFormat, Skeleton, SRGBColorSpace, TextureLoader } from 'three'
import type { Bone, Material, Mesh, Object3D, SkinnedMesh, Texture } from 'three'
import { AnimationName, useCharacterAnimations } from '@artificer-forge/engine/runtime'
import { ARMORS, BEARDS, BODIES, EYEBROWS, HAIR, HEADS, HORNS, RIG_MEDIUM } from '../utils/characterParts'
import { createHornMaterials, HORN_PATTERN_INDEX, type HornPattern } from '@artificer-forge/vfx'

// Dumb renderer for the modular-character rebind approach. Loads the canonical
// bare skeleton (rig_medium.glb) and assembles parts onto it:
//  - hair/beard/eyebrows are SKINNED → rebound (by bone name) to the shared skeleton
//  - the head is a RIGID mesh parented to the `head` bone (like a weapon attachment)
// Each mesh keeps a standard and a MeshToonMaterial variant; `toon` swaps between
// them. Skin/hair colors tint whichever variant is active.

// An equipped armor piece: which asset (id, matches an ARMORS preload entry), which
// body segments it hides (side-agnostic keys from the item's modular.hides), and an
// optional tint atlas URL (null/undefined = the piece's base/embedded map).
interface ArmorPiece { id: string, hides: string[], tint?: string | null }

const props = withDefaults(defineProps<{
  body: string | null
  head: string | null
  hair: string | null
  beard: string | null
  eyebrows: string | null
  horns?: string | null
  armor?: ArmorPiece[]
  skinColor: string
  hairColor: string
  hornColorA?: string
  hornColorB?: string
  hornPattern?: HornPattern
  hornWeight?: number
  toon: boolean
}>(), { armor: () => [], horns: null, hornColorA: '#2b2230', hornColorB: '#8a6d5c', hornPattern: 'gradient', hornWeight: 0.5 })

type Slot = 'body' | 'head' | 'hair' | 'beard' | 'eyebrows' | 'horns'
const SKINNED_SLOTS: Slot[] = ['body', 'hair', 'beard', 'eyebrows', 'horns']

// --- Preload everything up front (one useGLTF per asset, like the anim packs) ---
const rigLoader = useGLTF(RIG_MEDIUM)
const partLoaders = new Map<string, ReturnType<typeof useGLTF>>(
  [...BODIES, ...ARMORS, ...HEADS, ...HAIR, ...BEARDS, ...EYEBROWS, ...HORNS].map(p => [p.id, useGLTF(p.path, { draco: true })]),
)

const rigRoot = computed(() => rigLoader.nodes.value.Rig_Medium as Object3D | undefined)

// Animate the shared skeleton; rebound parts follow because they reference its bones.
const { play, actions } = useCharacterAnimations(rigRoot, 'Medium')
watch(() => Object.keys(actions).length, (n) => {
  if (n) play(AnimationName.IDLE_A)
}, { immediate: true })

// --- Shared skeleton bones, by name (absorbs cross-file joint-order divergence) ---
const boneByName = new Map<string, Bone>()
watch(rigRoot, (root) => {
  boneByName.clear()
  root?.traverse((o) => { if ((o as Bone).isBone) boneByName.set(o.name, o as Bone) })
}, { immediate: true })

// Few-step gradient ramp → hard cel bands instead of a smooth toon falloff.
const gradientMap = (() => {
  const steps = 4
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255)
  const tex = new DataTexture(data, steps, 1, RedFormat)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.needsUpdate = true
  return tex
})()

// Shared TSL pair for the horn slot (only one horn is attached at a time).
// Uniform-driven: colors/pattern/weight update without any material rebuild.
const hornSet = createHornMaterials(gradientMap)

function toToon(src: Material): MeshToonMaterial {
  const s = src as Material & { color?: Color, map?: MeshToonMaterial['map'] }
  const m = new MeshToonMaterial({
    color: s.color ? s.color.clone() : new Color(0xffffff),
    map: s.map ?? null,
    gradientMap,
  })
  m.name = src.name
  return m
}

// Build per-mesh standard + toon material sets once. Both are clones, so tinting
// one instance never leaks into another (or into the cached source GLTF).
function prepareMaterials(obj: Object3D) {
  obj.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !mesh.material) return
    const arr = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    // 'Horns'-named materials are replaced by the shared TSL pair instead of cloned.
    mesh.userData.std = arr.map(m => (m.name === 'Horns' ? hornSet.std : m.clone()))
    mesh.userData.toon = arr.map(m => (m.name === 'Horns' ? hornSet.toon : toToon(m)))
    mesh.userData.single = !Array.isArray(mesh.material)
    // Original atlas per slot, to restore when a tint is cleared (see applyArmorTint).
    mesh.userData.baseMap = (mesh.userData.std as Material[]).map(m => (m as Material & { map?: Texture | null }).map ?? null)
  })
}

// glTF authors UVs for flipY=false; TextureLoader defaults to true (would flip the
// atlas). Base color is sRGB. Cache so a tint loads once across pieces/re-renders.
const atlasCache = new Map<string, Texture>()
const texLoader = new TextureLoader()
function loadAtlas(url: string): Texture {
  let tex = atlasCache.get(url)
  if (!tex) {
    tex = texLoader.load(url, (t) => { t.needsUpdate = true })
    tex.flipY = false
    tex.colorSpace = SRGBColorSpace
    atlasCache.set(url, tex)
  }
  return tex
}

// Swap the atlas on both material sets (std + toon) so the tint survives the toon
// toggle. null tint restores the captured base map.
function applyArmorTint(obj: Object3D, tint: Texture | null) {
  obj.traverse((o) => {
    const mesh = o as Mesh
    const base = mesh.userData.baseMap as (Texture | null)[] | undefined
    if (!base) return
    ;[mesh.userData.std, mesh.userData.toon].forEach((set) => {
      (set as (Material & { map?: Texture | null })[] | undefined)?.forEach((m, i) => {
        m.map = tint ?? base[i] ?? null
        m.needsUpdate = true
      })
    })
  })
}

// Swap to the requested material set, then tint whatever is now active. Done
// together so colors always land on the visible materials (toon or standard).
function applyLook(obj: Object3D, toon: boolean, skin: Color, hair: Color) {
  obj.traverse((o) => {
    const mesh = o as Mesh
    const set = (toon ? mesh.userData.toon : mesh.userData.std) as Material[] | undefined
    if (!set) return
    mesh.material = mesh.userData.single ? set[0]! : set
    set.forEach((m) => {
      const c = (m as Material & { color?: Color }).color
      if (!c) return
      if (m.name === 'Skin') c.copy(skin)
      else if (m.name === 'Hair') c.copy(hair)
    })
  })
}

// Each prepared mesh is extracted from its source scene exactly once, rebound and
// its materials set up. Re-selecting just re-adds the cached object.
const prepared = new Map<string, Object3D>()
const attached = reactive<Record<Slot, string | null>>({ body: null, head: null, hair: null, beard: null, eyebrows: null })

function prepareSkinned(id: string): Object3D | null {
  const cached = prepared.get(id)
  if (cached) return cached
  // A part may hold ONE skinned mesh (hair/beard) or MANY (the segmented body:
  // arms, hands, legs, torso…). Collect every SkinnedMesh, rebind each to the
  // shared skeleton, and wrap them in a group so the slot stays one object.
  const nodes = partLoaders.get(id)?.nodes.value ?? {}
  const meshes = [...new Set(Object.values(nodes).filter(o => (o as SkinnedMesh).isSkinnedMesh))] as SkinnedMesh[]
  if (!meshes.length || !boneByName.size) return null

  const group = new Group()
  group.name = id
  for (const mesh of meshes) {
    // Rebind: shared live bones, in the part's own joint order + bind inverses.
    const bones = mesh.skeleton.bones.map(b => boneByName.get(b.name) ?? b)
    mesh.bind(new Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix)
    mesh.frustumCulled = false
    mesh.castShadow = true
    group.add(mesh)
  }

  prepareMaterials(group)
  prepared.set(id, group)
  return group
}

function prepareHead(id: string): Object3D | null {
  const cached = prepared.get(id)
  if (cached) return cached
  const node = partLoaders.get(id)?.nodes.value[id] as Object3D | undefined
  if (!node) return null
  node.traverse((o) => { (o as { castShadow?: boolean }).castShadow = true })
  prepareMaterials(node)
  prepared.set(id, node)
  return node
}

// Gradient bounds for the attached horn. Primary coordinate is uv.y normalized
// to this mesh's atlas region (follows the horn's length even when it curls);
// horns with collapsed UVs (TIF_Horns_D is a single point) fall back to the
// bind-pose Y range.
function updateHornBounds(obj: Object3D) {
  let vMin = Infinity
  let vMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  obj.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const uv = mesh.geometry.getAttribute('uv')
    for (let i = 0; i < (uv?.count ?? 0); i++) {
      const v = uv!.getY(i)
      vMin = Math.min(vMin, v)
      vMax = Math.max(vMax, v)
    }
    mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox
    if (!bb) return
    yMin = Math.min(yMin, bb.min.y)
    yMax = Math.max(yMax, bb.max.y)
  })
  const uvValid = vMax - vMin > 1e-4
  hornSet.uniforms.useUv.value = uvValid ? 1 : 0
  if (uvValid) {
    hornSet.uniforms.vMin.value = vMin
    hornSet.uniforms.vMax.value = vMax
  }
  if (yMin < yMax) {
    hornSet.uniforms.posMin.value = yMin
    hornSet.uniforms.posMax.value = yMax
  }
}

function detach(slot: Slot) {
  const id = attached[slot]
  if (!id) return
  const obj = prepared.get(id)
  obj?.parent?.remove(obj)
  attached[slot] = null
}

function syncSlot(slot: Slot, id: string | null) {
  if (attached[slot] === id && (!id || prepared.get(id)?.parent)) return
  detach(slot)
  if (!id) return
  const obj = slot === 'head' ? prepareHead(id) : prepareSkinned(id)
  if (!obj) return // asset not ready yet — watchEffect re-runs when it loads
  const parent = slot === 'head' ? boneByName.get('head') : rigRoot.value
  parent?.add(obj)
  attached[slot] = id
  if (slot === 'horns') updateHornBounds(obj)
}

// --- Armor: 0..n skinned pieces attached to the rig (set-sync by id) ---
const armorAttached = new Set<string>()

function syncArmor() {
  const desired = new Set(props.armor.map(a => a.id))
  for (const id of [...armorAttached]) {
    if (desired.has(id)) continue
    const obj = prepared.get(id)
    obj?.parent?.remove(obj)
    armorAttached.delete(id)
  }
  for (const piece of props.armor) {
    if (armorAttached.has(piece.id)) continue
    const obj = prepareSkinned(piece.id)
    if (!obj) continue // asset not ready yet — watchEffect re-runs when it loads
    rigRoot.value!.add(obj)
    armorAttached.add(piece.id)
  }
}

// A hide key ('torso', 'arm'…) matches body-group children named e.g.
// HUM_M_Torso_A, HUM_M_ArmL_A (side-agnostic: 'arm' hits both L and R).
function coverageMatchers(): RegExp[] {
  const keys = new Set(props.armor.flatMap(a => a.hides))
  return [...keys].map((k) => {
    const token = k[0]!.toUpperCase() + k.slice(1)
    return new RegExp(`_${token}(L|R)?(_|$)`)
  })
}

// Show/hide each body segment based on what the equipped armor covers. Declarative:
// unequipping shrinks the mask and segments flip back visible automatically.
function applyCoverage() {
  const bodyId = attached.body
  const group = bodyId ? prepared.get(bodyId) : null
  if (!group) return
  const matchers = coverageMatchers()
  group.children.forEach((child) => {
    child.visible = !matchers.some(r => r.test(child.name))
  })
}

// Reactive assembly: re-runs on prop changes AND when a pending asset finishes
// loading (prepare* reads the reactive `nodes` refs).
watchEffect(() => {
  if (!rigRoot.value || !boneByName.size) return
  syncSlot('head', props.head)
  SKINNED_SLOTS.forEach(slot => syncSlot(slot, props[slot]))
  syncArmor()
})

// Re-run coverage when armor changes or the body (re)attaches.
watchEffect(() => {
  void props.armor
  void attached.body
  applyCoverage()
})

// Apply shading mode + tints to every attached part (re-runs on toon/color/slot change).
watchEffect(() => {
  const skin = new Color(props.skinColor)
  const hair = new Color(props.hairColor)
  const toon = props.toon
  ;(['head', ...SKINNED_SLOTS] as Slot[]).forEach((slot) => {
    const id = attached[slot]
    const obj = id && prepared.get(id)
    if (obj) applyLook(obj, toon, skin, hair)
  })
  props.armor.forEach((piece) => {
    const obj = prepared.get(piece.id)
    if (obj) applyLook(obj, toon, skin, hair)
  })
})

// Push horn controls into the TSL uniforms (cheap — no material rebuilds).
watchEffect(() => {
  hornSet.uniforms.colorA.value.set(props.hornColorA)
  hornSet.uniforms.colorB.value.set(props.hornColorB)
  hornSet.uniforms.weight.value = props.hornWeight
  hornSet.uniforms.pattern.value = HORN_PATTERN_INDEX[props.hornPattern]
})

// Apply each armor piece's palette-atlas tint (re-runs on tint change / attach).
watchEffect(() => {
  props.armor.forEach((piece) => {
    const obj = prepared.get(piece.id)
    if (obj) applyArmorTint(obj, piece.tint ? loadAtlas(piece.tint) : null)
  })
})
</script>

<template>
  <primitive
    v-if="rigRoot"
    :object="rigRoot"
  />
</template>
