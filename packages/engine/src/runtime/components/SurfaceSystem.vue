<script setup lang="ts">
import { onUnmounted, shallowRef, watch, watchEffect } from 'vue'
import { Mesh, NoColorSpace, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import type { InstancedMesh, Texture } from 'three'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'
import { useLoop } from '@tresjs/core'
import {
  buildCharcoalSurfaceMaterial,
  buildFireSurfaceMaterial,
  buildPoolSurfaceMaterial,
  createFireBillboards,
  createInstancedEmberSystem,
} from '@artificer-forge/vfx'
import { useSurface } from '../useSurface'

// Global surface renderer (sibling to CombatSystem in Game.vue). Pure renderer:
// reads the engine's textures and renders the field. The engine (useSurface) owns
// all sim state and exposes `isActive` — true whenever the grid holds any surface,
// whether hydrated from the store (declarative scenes) or painted live (sandbox).
const { texture, fireTexture, stateTexture, dimensions, isActive, tick } = useSurface()

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => tick(delta))

// Flame flipbook loads lazily (no top-level await, so Game.vue needn't be a
// <Suspense> boundary) and only once a surface is active. Fire may be painted at
// any time, so we can't gate on a declared fire source — load whenever active.
// Non-surface scenes never flip isActive, so they never fetch it.
const flipbookTex = shallowRef<Texture | null>(null)
// Lightning bolt sprite, sampled by the pool material over electrified pools.
// Loaded lazily like the flipbook; linear (intensity mask, not colour) and repeat-
// wrapped so the material can layer it at several scales/rotations into arcs.
const lightningTex = shallowRef<Texture | null>(null)
watch(isActive, async (active) => {
  if (!active) return
  if (!flipbookTex.value) {
    const tex = await new TGALoader().loadAsync('/textures/flipbook/flame03/Flame03_16x4.tga')
    tex.colorSpace = SRGBColorSpace
    flipbookTex.value = tex
  }
  if (!lightningTex.value) {
    const lt = await new TextureLoader().loadAsync('/textures/electricity/spark_05.png')
    lt.colorSpace = NoColorSpace
    lt.wrapS = RepeatWrapping
    lt.wrapT = RepeatWrapping
    lightningTex.value = lt
  }
}, { immediate: true })

// Billboard density per m² of field. Billboards spread across the whole field and
// self-hide where there's no fire (firePresence in the shader), so this is a
// coverage/perf knob, not a per-pool count. Each hidden billboard still rasterizes,
// so high values trade fill-rate for denser flames.
const { billboardDensity = 5 } = defineProps<{
  /** Flame billboards per m² of surface field. Default 4 (1024 over a 16×16m field). */
  billboardDensity?: number
}>()

interface MeshSet {
  poolMesh: Mesh
  charcoalMesh: Mesh
  fireMesh: Mesh
  emberMesh: InstancedMesh
  flameBillboards: InstancedMesh | null
}

const meshes = shallowRef<MeshSet | null>(null)

function disposeMeshSet(set: MeshSet | null) {
  if (!set) return
  const all = [set.poolMesh, set.charcoalMesh, set.fireMesh, set.emberMesh, set.flameBillboards]
  for (const m of all) {
    if (!m) continue
    m.geometry.dispose()
    const mat = m.material
    Array.isArray(mat) ? mat.forEach(x => x.dispose()) : mat.dispose()
  }
}

// Rebuild meshes when the field (textures/dimensions) goes active or the flipbook
// arrives. Idle scenes hold meshes at null → zero draw calls. Each rebuild disposes
// the prior set, so navigation / activation cycles don't leak GPU buffers. The
// liquid/fire planes appear as soon as the field is active; the flame billboards
// fill in once the flipbook has loaded.
watchEffect(() => {
  if (!isActive.value) {
    disposeMeshSet(meshes.value)
    meshes.value = null
    return
  }

  const { width, depth } = dimensions.value
  const poolTex = texture.value
  const fireTex = fireTexture.value
  const stateTex = stateTexture.value
  const lightning = lightningTex.value
  const flipbook = flipbookTex.value

  disposeMeshSet(meshes.value)

  // Pool overlay (water/oil/poison/blood). No pointer handlers on purpose:
  // Tres only intersects objects with listeners, so clicks fall through to a
  // scene's own paint/move plane.
  // All layers are transparent. Distance-sorting is unreliable here — the
  // billboard/ember InstancedMeshes are positioned in the shader, so their
  // bounding spheres sit at the mesh origin and tie with the planes' centres.
  // Pin an explicit draw order instead. Charcoal still draws before the flames
  // (its depthWrite occludes flames behind the coal humps); flames/embers draw
  // last so the sort tie can't bury them under the bed.
  const poolGeo = new PlaneGeometry(width, depth)
  poolGeo.rotateX(-Math.PI / 2)
  const poolMesh = new Mesh(poolGeo, buildPoolSurfaceMaterial(poolTex, stateTex, lightning ?? undefined))
  poolMesh.position.set(0, 0.01, 0)
  poolMesh.renderOrder = 0

  // Charcoal bed — subdivided plane the material displaces upward for real relief.
  // Must sit at XZ origin: the material samples positionWorld.xz/positionLocal.xz.
  const charcoalGeo = new PlaneGeometry(width, depth, 160, 160)
  charcoalGeo.rotateX(-Math.PI / 2)
  const charcoalMesh = new Mesh(charcoalGeo, buildCharcoalSurfaceMaterial(fireTex))
  charcoalMesh.position.set(0, 0.012, 0)
  charcoalMesh.renderOrder = 1

  const fireGeo = new PlaneGeometry(width, depth)
  fireGeo.rotateX(-Math.PI / 2)
  const fireMesh = new Mesh(fireGeo, buildFireSurfaceMaterial(fireTex))
  fireMesh.position.set(0, 0.02, 0)
  fireMesh.renderOrder = 2

  const { mesh: emberMesh } = createInstancedEmberSystem(width, depth, fireTex)
  emberMesh.renderOrder = 3

  // Single field-wide flame cluster: billboards spread across the whole field and
  // self-hide where there's no fire, so flames appear over any fire cell — declared
  // or painted. Needs the flipbook; until it loads, planes render without flames.
  let flameBillboards: InstancedMesh | null = null
  if (flipbook) {
    const { mesh } = createFireBillboards(
      width,
      depth,
      fireTex,
      Math.round(width * depth * billboardDensity),
      Math.max(width, depth) / 2,
      flipbook,
    )
    mesh.position.set(0, 0, 0)
    mesh.renderOrder = 4
    flameBillboards = mesh
  }

  meshes.value = { poolMesh, charcoalMesh, fireMesh, emberMesh, flameBillboards }
})

onUnmounted(() => disposeMeshSet(meshes.value))
</script>

<template>
  <template v-if="meshes">
    <primitive :object="meshes.poolMesh" />
    <primitive :object="meshes.charcoalMesh" />
    <primitive :object="meshes.fireMesh" />
    <primitive :object="meshes.emberMesh" />
    <primitive v-if="meshes.flameBillboards" :object="meshes.flameBillboards" />
  </template>
</template>
