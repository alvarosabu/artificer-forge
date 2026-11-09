import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Object3D } from 'three'

export type Hand = 'mainHand' | 'offHand'

/** Hand slot bones of the KayKit rigs. GLTFLoader strips the dot from `handslot.r` and `handslot.l`. */
export const HAND_BONES: Record<Hand, string> = {
  mainHand: 'handslotr',
  offHand: 'handslotl',
}

const HANDS: Hand[] = ['mainHand', 'offHand']

/**
 * Parents items to the hand slot bones of `character`. An item inherits the bone's scale, so a clip that keys the hand slot scale shows or hides it.
 * The caller owns and disposes the items.
 */
export function useHeldItems(character: MaybeRefOrGetter<Object3D | null | undefined>) {
  const held: Record<Hand, Object3D | null> = { mainHand: null, offHand: null }
  const bones: Record<Hand, Object3D | null> = { mainHand: null, offHand: null }

  function mount(hand: Hand) {
    const item = held[hand]
    const bone = bones[hand]
    if (item && bone && item.parent !== bone) bone.add(item)
  }

  /** Puts `item` in `hand`, replacing whatever the hand held. */
  function hold(hand: Hand, item: Object3D) {
    if (held[hand] !== item) release(hand)
    held[hand] = item
    mount(hand)
  }

  /** Takes the item out of `hand` and out of the character. Returns it, or null when the hand was empty. */
  function release(hand: Hand) {
    const item = held[hand]
    if (!item) return null
    item.removeFromParent()
    held[hand] = null
    return item
  }

  watch(() => toValue(character), (model) => {
    for (const hand of HANDS) {
      bones[hand] = model?.getObjectByName(HAND_BONES[hand]) ?? null
      mount(hand)
    }
  }, { immediate: true })

  onScopeDispose(() => HANDS.forEach(release))

  return {
    hold,
    release,
    held: (hand: Hand) => held[hand],
    /** Null before the character loads. */
    bone: (hand: Hand) => bones[hand],
  }
}
