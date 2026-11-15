import type { InjectionKey } from 'vue'

export type PlayerPosition = [number, number, number]

export interface Player {
  /** Feet position in world space. */
  position: PlayerPosition
  /** Facing angle around +Y in radians, 0 facing +Z. */
  yaw: number
}

const PlayerKey: InjectionKey<Player> = Symbol('player')

// Chamo is the only writer. Replace position with a new array: shallowReactive does not see in-place changes.
export function providePlayer() {
  const player = shallowReactive<Player>({ position: [0, 0, 0], yaw: 0 })
  provide(PlayerKey, player)
  return player
}

/** Where the player is and where they face, shared by everything that reacts to them. */
export function usePlayer() {
  const player = inject(PlayerKey, null)
  if (!player) throw new Error('usePlayer() needs providePlayer() in the page')
  return player
}
