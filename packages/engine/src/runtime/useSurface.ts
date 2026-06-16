import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import { DataTexture, FloatType, LinearFilter, RGBAFormat } from 'three'
import {
  applyEvent,
  createSurfaceGrid,
  hasFireNear,
  packCells,
  packFire,
  packState,
  statusForCell,
  step,
  type SurfaceEvent,
  type SurfaceGrid,
  type SurfaceKind,
} from '@artificer-forge/engine/core'
import { useSurfaceStore } from './stores/surface'
import { useGameStore } from './stores/game'

interface SurfaceField {
  grid: SurfaceGrid
  /** Pool channels (water/oil/poison/blood) — feeds buildPoolSurfaceMaterial. */
  texture: DataTexture
  /** Fire amount — feeds charcoal/fire/ember/billboard meshes. */
  fireTexture: DataTexture
  /** Variant state (R=electrified, G=frozen) — feeds buildPoolSurfaceMaterial. */
  stateTexture: DataTexture
  data: Float32Array
  fireData: Float32Array
  stateData: Float32Array
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
  const { texture: stateTexture, data: stateData } = makeTexture(cols, rows)
  return { grid, texture, fireTexture, stateTexture, data, fireData, stateData }
}

interface SurfaceEngine {
  field: Ref<SurfaceField>
  texture: ComputedRef<DataTexture>
  fireTexture: ComputedRef<DataTexture>
  stateTexture: ComputedRef<DataTexture>
  /** World-space field extent in metres, derived from grid config. */
  dimensions: ComputedRef<{ width: number, depth: number }>
  /** True while the grid holds any surface (hydrated or painted). Drives the
   *  tick idle guard and SurfaceSystem's render gate — keyed on grid state, not
   *  store.sources, so live painting counts. */
  isActive: Readonly<Ref<boolean>>
  sample: (x: number, z: number) => ReturnType<SurfaceGrid['sample']>
  /** Live runtime seed (the paint entry point) — spreads + decays per kind. */
  seed: (x: number, z: number, kind: SurfaceKind) => void
  /** Apply a lightning/cold event at a point — flood-fills the liquid pool hit. */
  event: (x: number, z: number, event: SurfaceEvent) => void
  /** Wipe all live grid state (e.g. a paint scene tearing down). */
  clear: () => void
  tick: (delta: number) => void
}

/** Cheap scan: does the grid hold any surface right now? */
function gridHasContent(grid: SurfaceGrid): boolean {
  return grid.sources.length > 0 || grid.cells.some(c => c.kind !== null)
}

/** Cells of radiant-heat reach around a fire — entities within get `warm`. */
const FIRE_WARM_RADIUS = 5

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

  const isActive = ref(false)

  /** Clear + re-stamp every source from the store into the grid. */
  function hydrate() {
    const { grid } = field.value
    grid.clear()
    for (const src of surfaceStore.sources) {
      const { col, row } = grid.worldToCell(src.x, src.z)
      // Pre-placed pools: stamped at full radius. Infinite lifetime exempts them
      // from decay (the sim skips non-finite lifetimes) so the field stays put.
      grid.stampDisc(col, row, src.kind, src.radius, 1, src.lifetime ?? Number.POSITIVE_INFINITY)

      // Variant state: applied only to the cells this source actually filled
      // (kind match excludes cells already owned by an overlapping pool).
      if (src.frozen || src.electrified) {
        const own = grid.cellsInDisc(col, row, src.radius).filter(i => grid.cells[i]!.kind === src.kind)
        if (src.frozen) for (const i of own) grid.cells[i]!.frozen = true
        // Permanent charge source: re-arms every tick, lifetime never expires.
        if (src.electrified) grid.chargeSources.push({ cells: own, lifetime: Number.POSITIVE_INFINITY })
      }
    }
    isActive.value = gridHasContent(grid)
  }

  /** Live seed (paint). Goes straight to the grid — runtime state, not store data —
   *  so it spreads/decays per the kind config rather than being a static pool. */
  function seed(x: number, z: number, kind: SurfaceKind) {
    field.value.grid.seed(x, z, kind)
    isActive.value = true
  }

  /** Apply a lightning/cold event at a world point. No-ops over empty/non-liquid
   *  cells (applyEvent guards), so a click on bare ground is harmless. */
  function event(x: number, z: number, ev: SurfaceEvent) {
    applyEvent(field.value.grid, x, z, ev)
    isActive.value = true
  }

  function clear() {
    field.value.grid.clear()
    isActive.value = false
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
    // Idle guard keyed on grid state (covers both hydrated sources and live paint).
    // Non-surface scenes never flip isActive, so they pay ~nothing.
    if (!isActive.value) return

    const { grid, texture, fireTexture, stateTexture, data, fireData, stateData } = field.value
    step(grid, Math.min(delta, 0.1))
    packCells(grid.cells, data)
    packFire(grid.cells, fireData)
    packState(grid.cells, stateData)
    texture.needsUpdate = true
    fireTexture.needsUpdate = true
    stateTexture.needsUpdate = true

    // Contracted statuses (burning, poisoned, wet…) persist after leaving the
    // surface — no removal here until the tick/duration system exists to expire
    // them. Warm is the exception: it's radiant proximity, not a contracted
    // effect, so it's added/removed live as the entity enters/leaves fire range.
    for (const entity of gameStore.entities.values()) {
      if (entity.type !== 'character') continue
      const { col, row } = grid.worldToCell(entity.position.x, entity.position.z)
      const cell = grid.cellAt(col, row)
      const status = cell ? statusForCell(cell) : null
      if (status) {
        gameStore.addStatusEffect(entity.id, status) // dedupes — safe every frame
      }
      // Radiant heat: warm when fire is within FIRE_WARM_RADIUS cells but not
      // underfoot. Burning supersedes warm everywhere — both while standing on
      // fire and while a contracted burning lingers — so an already-burning
      // entity never picks up warm. Warm can still coexist with non-fire own-cell
      // statuses (e.g. wet while standing in water beside flames). Removed the
      // moment the entity leaves the radius (guard avoids rewriting the entity
      // object every frame for the non-warm majority).
      const isBurning = entity.statusEffects?.some(e => e.id === 'burning') ?? false
      const inWarmRange = !isBurning
        && cell?.kind !== 'fire'
        && hasFireNear(grid.cellAt, col, row, FIRE_WARM_RADIUS)
      if (inWarmRange) {
        gameStore.addStatusEffect(entity.id, 'warm')
      }
      else if (entity.statusEffects?.some(e => e.id === 'warm')) {
        gameStore.removeStatusEffect(entity.id, 'warm')
      }
    }

    // Painted/seeded surfaces decay; once the grid empties, go idle again.
    if (!gridHasContent(grid)) isActive.value = false
  }

  engine = scope.run(() => ({
    field,
    texture: computed(() => field.value.texture),
    fireTexture: computed(() => field.value.fireTexture),
    stateTexture: computed(() => field.value.stateTexture),
    dimensions: computed(() => {
      const { cols, rows, cell } = surfaceStore.gridConfig
      return { width: cols * cell, depth: rows * cell }
    }),
    isActive: readonly(isActive),
    sample: (x: number, z: number) => field.value.grid.sample(x, z),
    seed,
    event,
    clear,
    tick,
  }))!
  return engine
}
