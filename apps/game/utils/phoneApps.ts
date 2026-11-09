export interface PhoneApp {
  id: string
  label: string
  icon: string
  /** Tailwind gradient stops of the icon tile, read with `bg-linear-to-b`. */
  tile: string
}

export const PHONE_APPS: PhoneApp[] = [
  { id: 'camera', label: 'Camera', icon: 'i-lucide-camera', tile: 'from-violet-300 to-violet-500' },
  { id: 'map', label: 'Map', icon: 'i-lucide-map', tile: 'from-teal-300 to-teal-500' },
  { id: 'achievements', label: 'Achievements', icon: 'i-lucide-trophy', tile: 'from-amber-300 to-amber-500' },
  { id: 'settings', label: 'Settings', icon: 'i-lucide-settings', tile: 'from-slate-300 to-slate-500' },
]

/** Pinned to the dock on every page. */
export const PHONE_DOCK: PhoneApp[] = [
  { id: 'messages', label: 'Messages', icon: 'i-lucide-message-circle', tile: 'from-emerald-300 to-emerald-500' },
  { id: 'music', label: 'Music', icon: 'i-lucide-music', tile: 'from-rose-300 to-rose-500' },
  { id: 'journal', label: 'Journal', icon: 'i-lucide-notebook-pen', tile: 'from-orange-300 to-orange-500' },
  { id: 'weather', label: 'Weather', icon: 'i-lucide-cloud-sun', tile: 'from-sky-300 to-sky-500' },
]
