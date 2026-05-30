// Expose the Nuxt/Vue/Pinia auto-imports the game store relies on at module-eval
// and runtime, so store actions can be unit-tested in the plain `node` env.
import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'

// Leches debug-controls composable: stub `addFolder` to hand back a ref per
// requested control so the store factory can destructure them.
function useSharedLechesControls() {
  return {
    addFolder: (_name: string, controls: Record<string, unknown>) =>
      Object.fromEntries(Object.keys(controls).map(key => [key, ref(controls[key])])),
  }
}

Object.assign(globalThis, { computed, reactive, ref, defineStore, useSharedLechesControls })
