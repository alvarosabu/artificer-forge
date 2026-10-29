import type { AnimationAction } from 'three'
import type { Ref } from 'vue'
import type { PlayerState } from '~/composables/usePlayerController'

// Where a foot touches the ground, as a fraction of the clip. Measured from the lowest point of the footl and footr bones.
const CLIP_CONTACTS: Partial<Record<PlayerState, { clip: string, contacts: number[] }>> = {
  walk: { clip: 'Walking_A', contacts: [0, 0.51] },
  run: { clip: 'Running_A', contacts: [0.08, 0.59] },
  stroke: { clip: 'Swim_A', contacts: [0.37, 0.76] },
  fastStroke: { clip: 'Swim_B', contacts: [0.2, 0.7] },
}

// A run clip starts at phase 0, so its first contact can land 0.08 s after the last walk step.
const MIN_CONTACT_GAP = 0.15

/** True when the playhead moved past `contact` between two frames, including across the loop seam. */
function crossed(previous: number, current: number, contact: number) {
  return previous <= current
    ? previous < contact && contact <= current
    : contact > previous || contact <= current
}

/**
 * Calls `onContact` each time the current clip reaches one of its contacts.
 * Call `update` once per frame with the loop's elapsed time.
 */
export function useClipContacts(
  actions: Record<string, AnimationAction | undefined>,
  state: Readonly<Ref<PlayerState>>,
  onContact: (state: PlayerState) => void,
) {
  let clip: string | null = null
  let phase = 0
  let lastContact = -Infinity

  function update(elapsed: number) {
    const entry = CLIP_CONTACTS[state.value]
    const action = entry && actions[entry.clip]
    if (!entry || !action) {
      clip = null
      return
    }
    const next = action.time / action.getClip().duration
    // The first frame of a new clip only sets the phase, so a switch from walk to run does not fire a contact.
    if (clip === entry.clip) {
      for (const contact of entry.contacts) {
        if (!crossed(phase, next, contact) || elapsed - lastContact < MIN_CONTACT_GAP) continue
        lastContact = elapsed
        onContact(state.value)
      }
    }
    clip = entry.clip
    phase = next
  }

  return { update }
}