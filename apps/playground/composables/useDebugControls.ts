import { createSharedComposable } from '@vueuse/core'

/**
 * BVH debug toggle, backed by a Leches folder. Lives in the playground (not the
 * game store) so the store stays engine-portable — the engine must not depend on
 * dev tooling like @tresjs/leches.
 */
export const useDebugControls = createSharedComposable(() => {
  const { addFolder } = useSharedLechesControls()
  const { debugBvh } = addFolder('debug', { bvh: false })
  return { debugBvh }
})
