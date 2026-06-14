<script setup lang="ts">
import { Mesh, PlaneGeometry, SRGBColorSpace } from 'three'
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

// Global surface renderer (sibling to CombatSystem in Game.vue). Reads the
// engine's textures + the store's authored sources and renders the field. The
// engine (useSurface) owns all sim state; this component is a pure renderer.
const surfaceStore = useSurfaceStore()
const { texture, fireTexture, dimensions, tick } = useSurface()

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => tick(delta))

const hasSurfaces = computed(() => surfaceStore.sources.length > 0)
const hasFire = computed(() => surfaceStore.sources.some(s => s.kind === 'fire'))

// Flipbook loads lazily (no top-level await, so Game.vue needn't be a <Suspense>
// boundary) and only when a scene actually has fire — non-surface scenes never
// fetch it, honouring the global idle guard.
const flipbookTex = shallowRef<Texture | null>(null)
watch(hasFire, async (fire) => {
  if (!fire || flipbookTex.value) return
  const tex = await new TGALoader().loadAsync('/textures/flipbook/flame03/Flame03_16x4.tga')
  tex.colorSpace = SRGBColorSpace
  flipbookTex.value = tex
}, { immediate: true })

interface MeshSet {
  poolMesh: Mesh
  charcoalMesh: Mesh
  fireMesh: Mesh
  emberMesh: InstancedMesh
  flameBillboards: InstancedMesh[]
}

const meshes = shallowRef<MeshSet | null>(null)

function disposeMeshSet(set: MeshSet | null) {
  if (!set) return
  for (const m of [set.poolMesh, set.charcoalMesh, set.fireMesh, set.emberMesh, ...set.flameBillboards]) {
    m.geometry.dispose()
    const mat = m.material
    Array.isArray(mat) ? mat.forEach(x => x.dispose()) : mat.dispose()
  }
}

// Rebuild meshes when the field (textures/dimensions) or sources change. Non-surface
// scenes hold meshes at null → zero draw calls. A grid-config swap or source change
// disposes the prior set before rebuilding, so navigation doesn't leak GPU buffers.
watchEffect(() => {
  if (!hasSurfaces.value) {
    disposeMeshSet(meshes.value)
    meshes.value = null
    return
  }
  // Billboards need the flipbook; wait for it when the scene has fire.
  if (hasFire.value && !flipbookTex.value) return

  const { width, depth } = dimensions.value
  const poolTex = texture.value
  const fireTex = fireTexture.value
  const { cell } = surfaceStore.gridConfig

  disposeMeshSet(meshes.value)

  // Pool overlay (water/oil/poison/blood). No pointer handlers on purpose:
  // Tres only intersects objects with listeners, so clicks fall through to
  // CombatSystem's invisible click-to-move plane.
  const poolGeo = new PlaneGeometry(width, depth)
  poolGeo.rotateX(-Math.PI / 2)
  const poolMesh = new Mesh(poolGeo, buildPoolSurfaceMaterial(poolTex))
  poolMesh.position.set(0, 0.01, 0)

  // Charcoal bed — subdivided plane the material displaces upward for real relief.
  // Must sit at XZ origin: the material samples positionWorld.xz/positionLocal.xz.
  const charcoalGeo = new PlaneGeometry(width, depth, 160, 160)
  charcoalGeo.rotateX(-Math.PI / 2)
  const charcoalMesh = new Mesh(charcoalGeo, buildCharcoalSurfaceMaterial(fireTex))
  charcoalMesh.position.set(0, 0.012, 0)

  const fireGeo = new PlaneGeometry(width, depth)
  fireGeo.rotateX(-Math.PI / 2)
  const fireMesh = new Mesh(fireGeo, buildFireSurfaceMaterial(fireTex))
  fireMesh.position.set(0, 0.02, 0)

  const { mesh: emberMesh } = createInstancedEmberSystem(width, depth, fireTex)

  // One billboard cluster per fire source, centred over its pool (billboards
  // distribute within ±spawnRadius of the mesh origin).
  const flameBillboards = surfaceStore.sources
    .filter(s => s.kind === 'fire')
    .map((s) => {
      const { mesh } = createFireBillboards(width, depth, fireTex, 60, s.radius * cell, flipbookTex.value!)
      mesh.position.set(s.x, 0, s.z)
      return mesh
    })

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
    <primitive
      v-for="(billboards, i) in meshes.flameBillboards"
      :key="i"
      :object="billboards"
    />
  </template>
</template>
