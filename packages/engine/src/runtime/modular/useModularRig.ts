import { computed, onUnmounted, reactive, ref, shallowRef, toValue, watch, watchEffect, type MaybeRefOrGetter, type ShallowRef } from 'vue'
import { useTresContext } from '@tresjs/core'
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SRGBColorSpace,
  TextureLoader,
  type Bone,
  type Material,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createHornMaterials, type HornMaterialSet } from '@artificer-forge/vfx'
import type { CharacterAppearance } from '../../core/appearance'
import { loadGltf } from './gltfCache'
import { DEFAULT_RIG_KEY, manifestRigPath, resolvePartPath, resolvePartRig } from './partRegistry'
import { resolveSegmentMaterial, segmentMatcher } from './segmentMaterials'

// In-game modular character assembly. Loads the canonical bare skeleton and
// rebinds part meshes onto it (by bone name — joint order differs across part
// files). Unlike the customizer lab renderer, everything here is CLONED per
// instance from the shared GLTF cache: two modular characters on screen must
// never fight over the same Object3D or tint each other's materials.

/** An equipped armor piece resolved from item data (path comes from the item's
 * modular.assets, not the part registry). */
export interface ArmorPiece {
  id: string
  path: string
  /** Side-agnostic body-segment keys this piece hides (from item modular.hides). */
  hides: string[]
  /** Palette-atlas URL; null/undefined = the piece's embedded base atlas. */
  tint?: string | null
}

type Slot = 'body' | 'head' | 'hair' | 'beard' | 'eyebrows' | 'horns'
const SKINNED_SLOTS: Slot[] = ['body', 'hair', 'beard', 'eyebrows', 'horns']

// Tint atlases are shared (textures are immutable here) — cache across instances.
// glTF authors UVs for flipY=false; base color is sRGB.
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

export function useModularRig(
  appearance: MaybeRefOrGetter<CharacterAppearance | undefined>,
  armor?: MaybeRefOrGetter<ArmorPiece[]>,
): { rig: ShallowRef<Object3D | undefined> } {
  const rig = shallowRef<Object3D>()
  const boneByName = new Map<string, Bone>()

  // Bumped whenever an async load lands so the assembly watchEffect re-runs.
  const version = ref(0)

  // The selected body names the skeleton (small races bind to rig_small);
  // switching body across rig sizes tears the assembly down and rebuilds it.
  const rigKey = computed(() => {
    const body = toValue(appearance)?.body
    return body ? resolvePartRig(body) : DEFAULT_RIG_KEY
  })

  let rigToken = 0
  watch(rigKey, (key) => {
    const rigPath = manifestRigPath(key)
    if (!rigPath) {
      console.warn('[useModularRig] No part manifest registered — call registerPartManifest() at app startup.')
      return
    }
    const token = ++rigToken
    loadGltf(rigPath).then((gltf) => {
      if (token !== rigToken) return // superseded by a newer rig swap
      // Prepared clones are bound to the previous skeleton's bones — rebuild all.
      disposePrepared()
      boneByName.clear()
      // Own skeleton per instance; SkeletonUtils.clone keeps bone bindings intact.
      const cloned = cloneSkeleton(gltf.scene)
      let root: Object3D | undefined
      cloned.traverse((o) => {
        if (!root && o.name.startsWith('Rig_')) root = o
      })
      root ??= cloned
      root.traverse((o) => {
        if ((o as Bone).isBone) boneByName.set(o.name, o as Bone)
      })
      rig.value = root
      version.value++
    }).catch(err => console.warn(`[useModularRig] Failed to load rig ${rigPath}:`, err))
  }, { immediate: true })

  // --- Part sources (shared cache) and per-instance prepared clones ---
  const sources = new Map<string, GLTF>()
  const pendingIds = new Set<string>()
  const failedIds = new Set<string>()
  const prepared = new Map<string, Object3D>()

  function request(id: string, path?: string) {
    if (sources.has(id) || pendingIds.has(id) || failedIds.has(id)) return
    const url = path ?? resolvePartPath(id)
    if (!url) {
      console.warn(`[useModularRig] Unknown part id (not in registered manifest): ${id}`)
      failedIds.add(id)
      return
    }
    pendingIds.add(id)
    loadGltf(url).then((gltf) => {
      sources.set(id, gltf)
      pendingIds.delete(id)
      version.value++
    }).catch((err) => {
      console.warn(`[useModularRig] Failed to load part ${id} (${url}):`, err)
      pendingIds.delete(id)
      failedIds.add(id)
    })
  }

  // --- Horn material: TSL pair per instance on WebGPU, flat fallback on WebGL ---
  let tresCtx: ReturnType<typeof useTresContext> | null = null
  try {
    tresCtx = useTresContext()
  }
  catch { /* outside a TresCanvas (tests) — horn fallback material is used */ }
  const isWebGPU = computed(() => {
    const r = tresCtx?.renderer as { instance?: unknown } | undefined
    const instance = (r && 'instance' in r ? r.instance : toValue(r as never)) as { isWebGPURenderer?: boolean } | undefined
    return !!instance?.isWebGPURenderer
  })
  let hornSet: HornMaterialSet | null = null
  let hornFallback: MeshStandardMaterial | null = null
  function hornMaterial(): Material {
    if (isWebGPU.value) {
      hornSet ??= createHornMaterials()
      return hornSet.std
    }
    if (!hornFallback) {
      hornFallback = new MeshStandardMaterial({ roughness: 1, metalness: 0 })
      hornFallback.name = 'Horns'
    }
    return hornFallback
  }

  // Clone materials per instance so tints never leak into the cached GLTF or
  // other characters. Captures each material's base atlas for tint clearing.
  function adoptMesh(mesh: Mesh) {
    const arr = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const cloned = arr.map((m) => {
      if (m.name === 'Horns') return hornMaterial()
      const c = m.clone()
      // GLBs export Skin/Eyes glossy (0.7/0.5) — force matte.
      if (c.name === 'Skin' || c.name === 'Eyes') (c as MeshStandardMaterial).roughness = 1
      return c
    })
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!
    mesh.userData.materials = cloned
    // The assigned value (array or single), kept to restore segment overrides.
    mesh.userData.baseMaterial = mesh.material
    mesh.userData.baseMap = cloned.map(m => (m as Material & { map?: Texture | null }).map ?? null)
    mesh.castShadow = true
  }

  function prepareSkinned(id: string): Object3D | null {
    const cached = prepared.get(id)
    if (cached) return cached
    const src = sources.get(id)
    if (!src || !boneByName.size) return null
    // A part may hold ONE skinned mesh (hair/beard) or MANY (the segmented
    // body), and some files wrap the mesh in a Group — always traverse.
    const srcMeshes: SkinnedMesh[] = []
    src.scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) srcMeshes.push(o as SkinnedMesh)
    })
    if (!srcMeshes.length) return null

    const group = new Group()
    group.name = id
    for (const srcMesh of srcMeshes) {
      const mesh = srcMesh.clone() as SkinnedMesh // shares geometry; materials replaced below
      adoptMesh(mesh)
      // Rebind: this instance's live bones, in the part's own joint order +
      // bind inverses (joint order is NOT consistent across part files).
      const bones = srcMesh.skeleton.bones.map(b => boneByName.get(b.name) ?? b)
      mesh.bind(new Skeleton(bones, srcMesh.skeleton.boneInverses), srcMesh.bindMatrix)
      // Skinned bounds don't follow the shared skeleton.
      mesh.frustumCulled = false
      group.add(mesh)
    }
    prepared.set(id, group)
    return group
  }

  // Heads are RIGID meshes parented to the head bone (like a weapon attachment).
  function prepareHead(id: string): Object3D | null {
    const cached = prepared.get(id)
    if (cached) return cached
    const src = sources.get(id)
    if (!src) return null
    const node = src.scene.getObjectByName(id) ?? src.scene
    const clone = node.clone(true)
    clone.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) adoptMesh(mesh)
    })
    prepared.set(id, clone)
    return clone
  }

  // Gradient bounds for the attached horn: uv.y normalized to this mesh's atlas
  // region; horns with collapsed UVs fall back to the bind-pose Y range.
  function updateHornBounds(obj: Object3D) {
    if (!hornSet) return
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

  // --- Slot + armor attachment (set-sync, declarative) ---
  const attached = reactive<Record<Slot, string | null>>({ body: null, head: null, hair: null, beard: null, eyebrows: null, horns: null })
  const armorAttached = new Set<string>()

  function detach(slot: Slot) {
    const id = attached[slot]
    if (!id) return
    const obj = prepared.get(id)
    obj?.parent?.remove(obj)
    attached[slot] = null
  }

  function syncSlot(slot: Slot, id: string | null | undefined) {
    const want = id ?? null
    if (attached[slot] === want && (!want || prepared.get(want)?.parent)) return
    detach(slot)
    if (!want) return
    request(want)
    const obj = slot === 'head' ? prepareHead(want) : prepareSkinned(want)
    if (!obj) return // not loaded yet — version bump re-runs the effect
    const parent = slot === 'head' ? boneByName.get('head') : rig.value
    if (!parent) return
    parent.add(obj)
    attached[slot] = want
    if (slot === 'horns') updateHornBounds(obj)
  }

  function syncArmor(pieces: ArmorPiece[]) {
    const desired = new Set(pieces.map(p => p.id))
    for (const id of [...armorAttached]) {
      if (desired.has(id)) continue
      const obj = prepared.get(id)
      obj?.parent?.remove(obj)
      armorAttached.delete(id)
    }
    for (const piece of pieces) {
      if (armorAttached.has(piece.id)) continue
      request(piece.id, piece.path)
      const obj = prepareSkinned(piece.id)
      if (!obj) continue
      rig.value!.add(obj)
      armorAttached.add(piece.id)
    }
  }

  watchEffect(() => {
    void version.value
    const app = toValue(appearance)
    if (!rig.value || !app) return
    syncSlot('head', app.head)
    for (const slot of SKINNED_SLOTS) syncSlot(slot, app[slot])
    syncArmor(toValue(armor) ?? [])
  })

  // --- Coverage: hide body segments under equipped armor ---
  // A hide key ('torso', 'arm'…) matches body-group children named e.g.
  // HUM_M_Torso_A, HUM_M_ArmL_A (side-agnostic: 'arm' hits both L and R;
  // sided keys like 'armL' hit only that side).
  watchEffect(() => {
    void version.value
    const bodyId = attached.body
    const group = bodyId ? prepared.get(bodyId) : null
    if (!group) return
    // Only ATTACHED pieces hide segments — hiding for a piece that is still
    // loading would leave the character with invisible limbs for a moment.
    // (This effect runs after the assembly effect on the same trigger, so
    // armorAttached is already up to date.)
    const keys = new Set((toValue(armor) ?? []).filter(p => armorAttached.has(p.id)).flatMap(p => p.hides))
    const matchers = [...keys].map((k) => {
      const token = k[0]!.toUpperCase() + k.slice(1)
      return new RegExp(`_${token}(L|R)?(_|$)`)
    })
    group.children.forEach((child) => {
      child.visible = !matchers.some(r => r.test(child.name))
    })
  })

  // --- Look: skin/hair tints + horn controls (per-instance materials) ---
  watchEffect(() => {
    void version.value
    const app = toValue(appearance)
    if (!app) return
    const skin = new Color(app.skinColor)
    const hair = new Color(app.hairColor)
    const tintObject = (obj: Object3D) => {
      obj.traverse((o) => {
        const mats = (o as Mesh).userData?.materials as (Material & { color?: Color })[] | undefined
        mats?.forEach((m) => {
          if (!m.color) return
          if (m.name === 'Skin') m.color.copy(skin)
          else if (m.name === 'Hair') m.color.copy(hair)
        })
      })
    }
    for (const slot of ['head', ...SKINNED_SLOTS] as Slot[]) {
      const id = attached[slot]
      const obj = id ? prepared.get(id) : null
      if (obj) tintObject(obj)
    }
    // Armor pieces can expose skin too (e.g. sandals bring their own foot mesh
    // whose toes use the Skin material).
    for (const piece of toValue(armor) ?? []) {
      const obj = prepared.get(piece.id)
      if (obj && armorAttached.has(piece.id)) tintObject(obj)
    }
    if (hornSet) {
      hornSet.uniforms.colorA.value.set(app.hornColorA ?? '#2b2230')
      hornSet.uniforms.colorB.value.set(app.hornColorB ?? '#8a6d5c')
      hornSet.uniforms.weight.value = app.hornWeight ?? 0.5
      hornSet.uniforms.pattern.value = app.hornPattern === 'repeated' ? 1 : app.hornPattern === 'solid' ? 2 : 0
    }
    if (hornFallback) hornFallback.color.set(app.hornColorA ?? '#2b2230')
  })

  // --- Segment material overrides (e.g. a ghostly arm) ---
  // Swaps whole-mesh materials on matching body segments; factories come from
  // the app via registerSegmentMaterials. One material per override entry per
  // instance (uniforms like time-based noise must not be shared across chars).
  const overrideMaterials = new Map<string, Material>()

  watchEffect(() => {
    void version.value
    const bodyId = attached.body
    const group = bodyId ? prepared.get(bodyId) : null
    if (!group) return
    const overrides = toValue(appearance)?.segmentMaterials ?? []

    // Restore everything first so removed/changed overrides revert cleanly.
    group.children.forEach((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh && mesh.userData.baseMaterial) mesh.material = mesh.userData.baseMaterial
    })

    for (const [i, override] of overrides.entries()) {
      const factory = resolveSegmentMaterial(override.material)
      if (!factory) {
        console.warn(`[useModularRig] Unknown segment material (not registered): ${override.material}`)
        continue
      }
      const key = `${i}:${override.material}:${isWebGPU.value}`
      let material = overrideMaterials.get(key)
      if (!material) {
        material = factory(override.params, { isWebGPU: isWebGPU.value })
        overrideMaterials.set(key, material)
      }
      const matchers = override.segments.map(segmentMatcher)
      group.children.forEach((child) => {
        const mesh = child as Mesh
        if (mesh.isMesh && matchers.some(r => r.test(mesh.name))) mesh.material = material!
      })
    }
  })

  // --- Armor palette-atlas tints (per-instance materials, shared textures) ---
  watchEffect(() => {
    void version.value
    for (const piece of toValue(armor) ?? []) {
      const obj = prepared.get(piece.id)
      if (!obj || !armorAttached.has(piece.id)) continue
      const tint = piece.tint ? loadAtlas(piece.tint) : null
      obj.traverse((o) => {
        const mesh = o as Mesh
        const mats = mesh.userData?.materials as (Material & { map?: Texture | null })[] | undefined
        const base = mesh.userData?.baseMap as (Texture | null)[] | undefined
        if (!mats || !base) return
        mats.forEach((m, i) => {
          m.map = tint ?? base[i] ?? null
          m.needsUpdate = true
        })
      })
    }
  })

  // Per-instance clones own their materials — free them on rig swap/unmount.
  function disposePrepared() {
    for (const obj of prepared.values()) {
      obj.parent?.remove(obj)
      obj.traverse((o) => {
        const mats = (o as Mesh).userData?.materials as Material[] | undefined
        mats?.forEach((m) => {
          if (m !== hornSet?.std && m !== hornFallback) m.dispose()
        })
      })
    }
    prepared.clear()
    for (const slot of Object.keys(attached) as Slot[]) attached[slot] = null
    armorAttached.clear()
  }

  onUnmounted(() => {
    disposePrepared()
    for (const m of overrideMaterials.values()) m.dispose()
    overrideMaterials.clear()
  })

  return { rig }
}
