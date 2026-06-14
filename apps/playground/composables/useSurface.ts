import { DataTexture, FloatType, LinearFilter, RGBAFormat } from 'three'
import { createSurfaceGrid, type SurfaceGrid } from '~/utils/surfaces/grid'
import { step } from '~/utils/surfaces/sim'
import { packCells, packFire } from '~/utils/surfaces/texture'
import { statusForCell } from '~/utils/surfaces/matrix'

interface SurfaceField {
  grid: SurfaceGrid
  /** Pool channels (water/oil/poison/blood) — feeds buildPoolSurfaceMaterial. */
  texture: DataTexture
  /** Fire amount — feeds charcoal/fire/ember/billboard meshes. */
  fireTexture: DataTexture
  data: Float32Array
  fireData: Float32Array
}

function makeTexture(cols: number, rows: number): { texture: DataTexture, data: Float32Array } {
  const data = new Float32Array(cols * rows * 4)
  const texture = new DataTexture(data, cols, rows, RGBAFormat, FloatType)
  texture.minFilter = LinearFilter // bilinear smoothing between cells — de-blocks the grid
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return { texture, data }
}

function buildField(cols: number, rows: number, cell: number): SurfaceField {
  const grid = createSurfaceGrid(cols, rows, cell)
  const { texture, data } = makeTexture(cols, rows)
  const { texture: fireTexture, data: fireData } = makeTexture(cols, rows)
  return { grid, texture, fireTexture, data, fireData }
}

interface SurfaceEngine {
  field: Ref<SurfaceField>
  texture: ComputedRef<DataTexture>
  fireTexture: ComputedRef<DataTexture>
  /** World-space field extent in metres, derived from grid config. */
  dimensions: ComputedRef<{ width: number, depth: number }>
  sample: (x: number, z: number) => ReturnType<SurfaceGrid['sample']>
  tick: (delta: number) => void
}

let engine: SurfaceEngine | null = null

/**
 * Singleton surface engine. Owns the grid + textures + sim loop; hydrates from
 * useSurfaceStore (the level-data target). SurfaceSystem.vue consumes the textures
 * and drives `tick` via useLoop — the engine never registers a loop itself, since
 * useLoop must run inside a Tres component context.
 */
export function useSurface(): SurfaceEngine {
  if (engine) return engine

  const surfaceStore = useSurfaceStore()
  const gameStore = useGameStore()

  // Detached scope: this is an app-lifetime singleton, but useSurface() is first
  // called from SurfaceSystem's setup. Without a detached scope the watchers below
  // would bind to that component and die on route change, leaving the cached engine
  // with dead hydration watchers on the next page.
  const scope = effectScope(true)

  const field = shallowRef<SurfaceField>(
    buildField(surfaceStore.gridConfig.cols, surfaceStore.gridConfig.rows, surfaceStore.gridConfig.cell),
  )

  /** Clear + re-stamp every source from the store into the grid. */
  function hydrate() {
    const { grid } = field.value
    grid.clear()
    for (const src of surfaceStore.sources) {
      const { col, row } = grid.worldToCell(src.x, src.z)
      // Pre-placed pools: stamped at full radius. Infinite lifetime exempts them
      // from decay (the sim skips non-finite lifetimes) so the field stays put.
      grid.stampDisc(col, row, src.kind, src.radius, 1, src.lifetime ?? Number.POSITIVE_INFINITY)
    }
  }

  scope.run(() => {
    // Rebuild the whole field when grid dimensions change (rare — level swap),
    // then re-hydrate sources into the fresh grid.
    watch(
      () => surfaceStore.gridConfig,
      (cfg) => {
        field.value = buildField(cfg.cols, cfg.rows, cfg.cell)
        hydrate()
      },
      { deep: true },
    )

    // Re-stamp whenever the source list changes.
    watch(() => surfaceStore.sources, hydrate, { deep: true, immediate: true })
  })

  function tick(delta: number) {
    // Idle guard: no authored sources ⇒ nothing to simulate or upload. Non-surface
    // scenes pay ~nothing. (Revisit when events spawn cells with no source def.)
    if (surfaceStore.sources.length === 0) return

    const { grid, texture, fireTexture, data, fireData } = field.value
    step(grid, Math.min(delta, 0.1))
    packCells(grid.cells, data)
    packFire(grid.cells, fireData)
    texture.needsUpdate = true
    fireTexture.needsUpdate = true

    // Statuses persist after leaving the surface — no removal here until the
    // tick/duration system exists to expire them.
    for (const entity of gameStore.entities.values()) {
      if (entity.type !== 'character') continue
      const cell = grid.sample(entity.position.x, entity.position.z)
      const status = statusForCell(cell)
      if (status) {
        gameStore.addStatusEffect(entity.id, status) // dedupes — safe every frame
      }
    }
  }

  engine = scope.run(() => ({
    field,
    texture: computed(() => field.value.texture),
    fireTexture: computed(() => field.value.fireTexture),
    dimensions: computed(() => {
      const { cols, rows, cell } = surfaceStore.gridConfig
      return { width: cols * cell, depth: rows * cell }
    }),
    sample: (x: number, z: number) => field.value.grid.sample(x, z),
    tick,
  }))!
  return engine
}
