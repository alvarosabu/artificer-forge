import type { MaybeRefOrGetter } from 'vue'
import type { CommandGroup } from './useCommandPalette'

const GROUP_PREFIX = 'anim-'

function groupClips(clipNames: string[]) {
  const byPrefix = new Map<string, string[]>()
  for (const name of [...clipNames].sort()) {
    const prefix = name.split('_')[0]!
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), name])
  }

  const groups: [string, string[]][] = []
  const other: string[] = []
  for (const [prefix, names] of byPrefix) {
    if (names.length > 1) groups.push([prefix, names])
    else other.push(...names)
  }
  if (other.length) groups.push(['Other', other])
  return groups
}

/** Dev palette commands that preview any clip. Groups follow `clipNames`, so they appear once the model loads. */
export function useAnimationCommands(
  clipNames: MaybeRefOrGetter<string[]>,
  player: { previewClip: (name: string) => void, stopPreview: () => void },
) {
  const { registerGroup, unregisterGroup, close } = useCommandPalette()
  let registered: string[] = []

  function run(action: () => void) {
    action()
    close()
  }

  function unregister() {
    registered.forEach(unregisterGroup)
    registered = []
  }

  function register(names: string[]) {
    unregister()
    if (!names.length) return

    const groups: CommandGroup[] = [{
      id: `${GROUP_PREFIX}control`,
      label: 'Animation',
      items: [{
        id: 'anim-stop-preview',
        label: 'Back to gameplay animation',
        icon: 'i-lucide-rotate-ccw',
        onSelect: () => run(player.stopPreview),
      }],
    }]

    for (const [prefix, clips] of groupClips(names)) {
      groups.push({
        id: `${GROUP_PREFIX}${prefix}`,
        label: `Animations: ${prefix}`,
        items: clips.map(clip => ({
          id: `anim-${clip}`,
          label: clip.replace(/_/g, ' '),
          icon: 'i-lucide-play',
          onSelect: () => run(() => player.previewClip(clip)),
        })),
      })
    }

    groups.forEach(registerGroup)
    registered = groups.map(g => g.id)
  }

  watch(() => toValue(clipNames), register, { immediate: true })
  onUnmounted(unregister)
}
