import { reactive, shallowRef } from 'vue'

// Offscreen thumbnail generator for modular parts. One <ThumbStudio> renders the
// `active` descriptor with 3-point portrait lighting and reports back a PNG
// dataURL. Bakes are serialized (one GL context, one subject at a time) and
// cached by key, so grids stay cheap regardless of how many parts they show.

export type ThumbSlot = 'head' | 'hair' | 'beard' | 'eyebrows' | 'horns'

export interface ThumbDescriptor {
  key: string // cache key — stable per (slot, part, base head)
  slot: ThumbSlot
  partId: string
  partPath: string
  // Base head the part sits on (ignored for slot === 'head', where the part IS
  // the head). Non-head thumbnails render on a neutral gray head.
  headId: string
  headPath: string
}

// Module-scope singleton state: one studio shared by every picker.
const active = shallowRef<ThumbDescriptor | null>(null)
const cache = reactive(new Map<string, string>())
const requested = new Set<string>()
const queue: ThumbDescriptor[] = []
let current: { resolve: (url: string) => void, reject: (err: unknown) => void } | null = null

export function thumbKey(slot: ThumbSlot, partId: string, headId: string): string {
  return slot === 'head' ? `head:${partId}` : `${slot}:${partId}:${headId}`
}

function kick() {
  if (active.value || !queue.length) return
  const next = queue.shift()!
  let timer: ReturnType<typeof setTimeout>
  const settle = <T>(fn: (v: T) => void) => (v: T) => {
    clearTimeout(timer)
    fn(v)
  }
  current = {
    resolve: settle<string>((url) => {
      cache.set(next.key, url)
      active.value = null
      current = null
      kick()
    }),
    reject: settle<unknown>(() => {
      requested.delete(next.key) // allow a retry on a later pass
      active.value = null
      current = null
      kick()
    }),
  }
  active.value = next
  timer = setTimeout(() => current?.reject(new Error(`thumb bake timed out: ${next.key}`)), 10_000)
}

export function useModularThumbnails() {
  // Read a cached thumbnail (reactive). Undefined while it bakes.
  function thumbUrl(key: string): string | undefined {
    return cache.get(key)
  }

  // Request a bake if we don't already have it (or haven't queued it).
  function ensureThumb(desc: ThumbDescriptor) {
    if (cache.has(desc.key) || requested.has(desc.key)) return
    requested.add(desc.key)
    queue.push(desc)
    kick()
  }

  // Studio side: it renders `active`, then reports the result.
  function captured(url: string) {
    current?.resolve(url)
  }
  function failed(err: unknown) {
    current?.reject(err)
  }

  return { active, thumbUrl, ensureThumb, captured, failed }
}
