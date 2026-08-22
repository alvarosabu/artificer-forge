import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'af:portraits'

// A bake is a base64 PNG data URL of roughly 400 KB, against a localStorage budget
// of about 5 MB per origin. Every distinct look (each equipment change) mints a new
// entry and nothing else evicts them, so the cache is capped: without this the
// quota fills after ~10 gear swaps and every later write silently fails.
const MAX_ENTRIES = 8

/** Client-only persistence — guard on `window` so the store is safe under SSR. */
const isClient = typeof window !== 'undefined'

export const usePortraitStore = defineStore('portraits', () => {
  // Keyed by portrait SIGNATURE, never by entity id: ids are minted per spawn
  // (`hero_${Date.now()}`), so an id-keyed cache cannot survive a reload. Two
  // characters that look identical sharing one bake is correct, not a collision.
  const entries = ref<Record<string, string>>({})
  let hydrated = false

  // Idempotent, and called lazily from get() rather than at setup time or from a
  // root onMounted(). Both of those are wrong: Pinia restores this store's state
  // from the SSR payload (an empty object) right after the setup function runs, so
  // an eager read is overwritten, and a root component's onMounted() fires AFTER its
  // children's, so the first lookup of the session would miss a cache nobody had
  // read yet and bake a fresh copy for nothing.
  function hydrate() {
    if (!isClient || hydrated) return
    hydrated = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      // Ignore anything that isn't the current shape — an older build stored
      // `{ url, signature }` objects under entity ids, and those keys can never hit.
      if (parsed && typeof parsed === 'object') {
        entries.value = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
        )
      }
    }
    catch {
      // corrupt cache -> start empty, portraits regenerate
    }
  }

  function persist() {
    if (!isClient) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
    }
    catch {
      // Quota exceeded despite the cap (other origins' data, a huge bake). Drop the
      // oldest half and try once more; if that still fails, portraits regenerate.
      const keys = Object.keys(entries.value)
      for (const key of keys.slice(0, Math.ceil(keys.length / 2))) delete entries.value[key]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
      }
      catch {}
    }
  }

  function get(signature: string): string | undefined {
    hydrate()
    const url = entries.value[signature]
    if (url === undefined) return undefined
    // Touch for recency so eviction drops a look nobody is showing rather than the
    // party's own portraits. In-memory only: persisting on every read would write
    // megabytes of JSON per frame's worth of lookups.
    delete entries.value[signature]
    entries.value[signature] = url
    return url
  }

  function set(signature: string, url: string) {
    hydrate() // never persist a fresh bake over a cache we have not read yet
    entries.value[signature] = url
    // Insertion order is the recency order, and JSON round-trips it, so the oldest
    // key is simply the first one.
    const keys = Object.keys(entries.value)
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) {
      delete entries.value[key]
    }
    persist()
  }

  function invalidate(signature: string) {
    delete entries.value[signature]
    persist()
  }

  return { entries, hydrate, get, set, invalidate }
})
