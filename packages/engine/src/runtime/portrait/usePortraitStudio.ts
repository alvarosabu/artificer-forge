import { ref, shallowRef } from 'vue'
import type { CharacterAppearance } from '../../core/appearance'
import type { Equipment } from '../stores/game'
import type { ArmorPiece } from '../modular/useModularRig'
import { createBakeQueue } from './portraitBakeQueue'

export interface PortraitSubjectDescriptor {
  /** Single-GLB characters. Omitted for modular ones. */
  model?: string
  /** Modular characters: cosmetic recipe assembled via useModularRig. */
  appearance?: CharacterAppearance
  /** Modular characters: resolved armor pieces (from the entity's equipment). */
  armor?: ArmorPiece[]
  rig: string
  equipment: Equipment
  // Optional backdrop texture URL (per-character). Undefined = transparent canvas.
  background?: string
}

// Singleton state (module scope): one studio, shared by all callers.
const active = shallowRef<PortraitSubjectDescriptor | null>(null)
// Requests that have been asked for but not yet settled, INCLUDING the ones still
// waiting their turn in the queue. `active` only covers the one currently rendering
// and drops to null between every capture, so it is the wrong signal for deciding
// whether the studio canvas should exist: a party of four would tear the WebGPU
// device down and build it back up three times. This count spans the whole burst.
const pending = ref(0)
let current: { resolve: (url: string) => void, reject: (err: unknown) => void } | null = null
const queue = createBakeQueue()

export function usePortraitStudio() {
  // Producer side: request a portrait; resolves with a PNG dataURL.
  function bake(key: string, subject: PortraitSubjectDescriptor): Promise<string> {
    // Counted per CALLER and released per caller, so deduped requests (which share
    // one promise) still balance out.
    pending.value++
    return queue.request(key, () => new Promise<string>((resolve, reject) => {
      // Watchdog: a stuck render (backgrounded tab, dropped rAF, never-ready
      // subject) must not hang the serialized queue forever. Cleared once settled.
      let timer: ReturnType<typeof setTimeout>
      const settle = <T>(fn: (v: T) => void) => (v: T) => {
        clearTimeout(timer)
        fn(v)
      }
      current = { resolve: settle(resolve), reject: settle(reject) }
      active.value = subject // tells <PortraitStudio> to render this subject
      timer = setTimeout(() => failed(new Error(`portrait bake timed out: ${key}`)), 10_000)
    })).finally(() => { pending.value-- })
  }

  // Consumer side: <PortraitStudio> calls these once it has rendered + captured.
  function captured(url: string) {
    current?.resolve(url)
    current = null
    active.value = null
  }

  function failed(err: unknown) {
    current?.reject(err)
    current = null
    active.value = null
  }

  return { active, pending, bake, captured, failed }
}
