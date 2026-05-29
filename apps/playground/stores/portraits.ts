export interface PortraitEntry {
  url: string
  signature: string
}

const STORAGE_KEY = 'af:portraits'

export const usePortraitStore = defineStore('portraits', () => {
  const entries = ref<Record<string, PortraitEntry>>({})

  // Client-only; localStorage is unavailable during SSR.
  function hydrate() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) entries.value = JSON.parse(raw)
    }
    catch {
      // corrupt cache -> start empty, portraits regenerate
    }
  }

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
    }
    catch {
      // quota exceeded -> ignore; portraits regenerate next session
    }
  }

  function get(id: string): PortraitEntry | undefined {
    return entries.value[id]
  }

  function set(id: string, url: string, signature: string) {
    entries.value[id] = { url, signature }
    persist()
  }

  function invalidate(id: string) {
    delete entries.value[id]
    persist()
  }

  return { entries, hydrate, get, set, invalidate }
})
