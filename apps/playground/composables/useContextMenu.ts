import type { InjectionKey } from 'vue'

export interface ContextMenuState {
  open: boolean
  entityId: string | null
  x: number
  y: number
}

export interface ContextMenuApi {
  state: ContextMenuState
  open: (entityId: string, x: number, y: number) => void
  close: () => void
  onAction: (handler: (action: string, entityId: string) => void) => void
}

export const ContextMenuKey: InjectionKey<ContextMenuApi> = Symbol('context-menu')

export function useContextMenuProvider() {
  const state = reactive<ContextMenuState>({
    open: false,
    entityId: null,
    x: 0,
    y: 0,
  })

  const actionHandlers = new Set<(action: string, entityId: string) => void>()

  function open(entityId: string, x: number, y: number) {
    state.entityId = entityId
    state.x = x
    state.y = y
    state.open = true
  }

  function close() {
    state.open = false
  }

  function onAction(handler: (action: string, entityId: string) => void) {
    actionHandlers.add(handler)
    onUnmounted(() => actionHandlers.delete(handler))
  }

  function emitAction(action: string, entityId: string) {
    actionHandlers.forEach(handler => handler(action, entityId))
  }

  const api: ContextMenuApi = {
    state,
    open,
    close,
    onAction,
  }

  provide(ContextMenuKey, api)

  return { state, open, close, emitAction }
}

export function useContextMenu() {
  const api = inject(ContextMenuKey)
  if (!api) {
    throw new Error('useContextMenu must be used within a Game component')
  }
  return api
}
