import type { SurfaceGridConfig, SurfaceSourceDef } from '@artificer-forge/engine/core'

/** Default field: 32×32 cells at 0.5m ⇒ 16×16m, centred on world origin. */
const DEFAULT_GRID: SurfaceGridConfig = { cols: 32, rows: 32, cell: 0.5 }

/**
 * Declarative surface DATA only — the level-loader target. Holds no engine state
 * (grid, textures, sim live in useSurface). A scene seeds sources here; useSurface
 * watches and hydrates the grid. Later a level loader replaces the manual seeding.
 */
export const useSurfaceStore = defineStore('surface', () => {
  const gridConfig = ref<SurfaceGridConfig>({ ...DEFAULT_GRID })
  const sources = ref<SurfaceSourceDef[]>([])

  function addSource(def: SurfaceSourceDef) {
    sources.value.push(def)
  }

  function setSources(defs: SurfaceSourceDef[]) {
    sources.value = defs
  }

  function setGridConfig(config: Partial<SurfaceGridConfig>) {
    gridConfig.value = { ...gridConfig.value, ...config }
  }

  function clearSurfaces() {
    sources.value = []
    gridConfig.value = { ...DEFAULT_GRID }
  }

  return { gridConfig, sources, addSource, setSources, setGridConfig, clearSurfaces }
})
