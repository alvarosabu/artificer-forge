<script setup lang="ts">
import { Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
import type { SurfaceSourceDef } from '@artificer-forge/engine/core'

// Demo surface layout. These pre-placed pools stand in for what a level loader
// will eventually seed into useSurfaceStore from level data — the engine
// (useSurface) watches the store and hydrates the grid; SurfaceSystem (global,
// in Game.vue) renders it. Lifetime omitted ⇒ permanent pool (no decay).
const DEMO_SURFACES: SurfaceSourceDef[] = [
  // Plain pools (unchanged) — the four corners + fire.
  { kind: 'water', x: -4, z: -4, radius: 4 },
  { kind: 'oil', x: 4, z: -4, radius: 3 },
  { kind: 'poison', x: -4, z: 4, radius: 3 },
  { kind: 'blood', x: 4, z: 4, radius: 3 },
  { kind: 'fire', x: 5, z: 0, radius: 3 },
  // Variant pools — separate, so they don't merge with the plain ones. Walk the
  // hero onto them to see the variant + status:
  //  • frozen water     — frosted semi-opaque ice sheet, no status (slippery, v1)
  //  • electrified blood — cyan arcs over red, inflicts `shocked`
  { kind: 'water', x: 0, z: -5.5, radius: 3, frozen: true },
  { kind: 'blood', x: 0, z: 5.5, radius: 3, electrified: true },
]

const gameStore = useGameStore()
const surfaceStore = useSurfaceStore()
const { setCharacterRef } = useSceneRefs()
const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands()

onMounted(async () => {
  surfaceStore.setSources(DEMO_SURFACES)

  const heroId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  registerEntities()
})

onUnmounted(() => {
  surfaceStore.clearSurfaces()
  unregisterEntities()
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)
</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />

  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Floor />
</template>
