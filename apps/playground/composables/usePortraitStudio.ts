import type { Equipment } from '~/stores/game'
import { createBakeQueue } from '~/utils/portraitBakeQueue'

export interface PortraitSubjectDescriptor {
  model: string
  rig: string
  equipment: Equipment
  // Optional backdrop texture URL (per-character). Undefined = transparent canvas.
  background?: string
}

// Singleton state (module scope): one studio, shared by all callers.
const active = shallowRef<PortraitSubjectDescriptor | null>(null)
let current: { resolve: (url: string) => void, reject: (err: unknown) => void } | null = null
const queue = createBakeQueue()

export function usePortraitStudio() {
  // Producer side: request a portrait; resolves with a PNG dataURL.
  function bake(key: string, subject: PortraitSubjectDescriptor): Promise<string> {
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
    }))
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

  return { active, bake, captured, failed }
}
