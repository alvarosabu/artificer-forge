// Re-export of the engine's shared GLTF parse cache so app-side consumers
// (thumbnail studio) and engine modular assembly share ONE DRACO decoder and
// one per-path cache. See engine runtime/modular/gltfCache.ts for the why.
export { loadGltf } from '@artificer-forge/engine/runtime'
