import type { InjectionKey } from 'vue'
import type { GradingContext } from '@artificer-forge/engine/runtime'

// Game-only: every mesh here is graded and there is one context per scene, so
// inject beats prop drilling. Engine components still take `grading` as a prop.
const GradingKey: InjectionKey<GradingContext> = Symbol('grading')

export function provideGrading(grading: GradingContext) {
  provide(GradingKey, grading)
}

export function useGrading() {
  const grading = inject(GradingKey, null)
  // Throw instead of returning undefined: a missing context renders white,
  // unlit meshes that are hard to trace back to this.
  if (!grading) throw new Error('useGrading() needs an <EnvironmentController> ancestor')
  return grading
}
