import { reactive } from 'vue'

// Module-level singleton: shared by the node components AND the canvas (for edge
// handle remapping). Vue Flow does not reliably propagate `:nodes` data mutations
// into rendered nodes, so expansion state lives here and is read directly.
const expanded = reactive<Record<string, boolean>>({})

export function useNodeExpansion() {
  function isExpanded(id: string): boolean {
    return expanded[id] ?? false
  }
  function toggle(id: string): void {
    expanded[id] = !isExpanded(id)
  }
  function setAll(ids: string[], value: boolean): void {
    for (const id of ids) expanded[id] = value
  }
  function reset(): void {
    for (const k of Object.keys(expanded)) delete expanded[k]
  }
  return { expanded, isExpanded, toggle, setAll, reset }
}
