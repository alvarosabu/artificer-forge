const TOAST_DURATION = 5000
// Lets the closing toast slide out before the next one slides in.
const QUEUE_GAP = 250

const unlocked = ref(new Set<AchievementId>())
const pending: AchievementId[] = []
let showing = false

/** Unlocks achievements for this session and announces each new one with a toast, one at a time. */
export function useAchievements() {
  const toast = useToast()

  function showNext() {
    const id = pending.shift()
    showing = id !== undefined
    if (!id) return
    const { name, icon } = ACHIEVEMENTS[id]
    toast.add({
      title: '🏆 Achievement Unlocked',
      description: name,
      avatar: {
        src: icon,
        alt: '',
        ui: { image: 'object-contain [image-rendering:pixelated]' },
      },
      duration: TOAST_DURATION,
      orientation: 'horizontal',
      close: false,
      progress: false,
      ui: {
        root: 'achievement-toast gap-4 rounded-xl bg-default p-3 pe-5 ring-0 shadow-xl',
        avatar: 'size-16 rounded-lg bg-[#141c38] p-1.5 ring-1 ring-white/10',
        title: 'text-sm text-toned',
        description: 'mt-1.5 text-base font-black text-highlighted',
      },
      'onUpdate:open': (open) => {
        if (!open) setTimeout(showNext, QUEUE_GAP)
      },
    })
  }

  /** Returns false when the achievement was already unlocked. */
  function unlock(id: AchievementId) {
    if (unlocked.value.has(id)) return false
    unlocked.value.add(id)
    pending.push(id)
    if (!showing) showNext()
    return true
  }

  function lock(id: AchievementId) {
    unlocked.value.delete(id)
    const index = pending.indexOf(id)
    if (index !== -1) pending.splice(index, 1)
  }

  return { unlocked: readonly(unlocked), unlock, lock }
}
