import type { InjectionKey, Ref } from 'vue'

export type PlayerPosition = [number, number, number]

const PlayerPositionKey: InjectionKey<Readonly<Ref<Readonly<PlayerPosition>>>> = Symbol('player-position')

// Chamo is the only writer (through v-model in the page), so consumers get a read-only ref.
export function providePlayerPosition(position: Ref<PlayerPosition>) {
  provide(PlayerPositionKey, readonly(position))
}

export function usePlayerPosition() {
  const position = inject(PlayerPositionKey, null)
  if (!position) throw new Error('usePlayerPosition() needs providePlayerPosition() in the page')
  return position
}
