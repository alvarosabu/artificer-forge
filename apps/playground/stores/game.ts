// Re-export shim: the game store now lives in @artificer-forge/engine/runtime.
// Kept here so Nuxt's Pinia auto-import (useGameStore) and existing `~/stores/game`
// type imports keep resolving without touching every consumer. Content is wired in
// plugins/gameData.ts via useGameStore().configureContent(...).
export * from '@artificer-forge/engine/runtime'
