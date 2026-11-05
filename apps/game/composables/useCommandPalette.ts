export interface CommandItem {
  id: string
  label: string
  icon?: string
  onSelect: () => void
}

export interface CommandGroup {
  id: string
  label: string
  items: CommandItem[]
}

const isOpen = ref(false)
const groups = ref<CommandGroup[]>([])

/** Shared registry behind the dev command palette. Any component can add or remove its own command groups. */
export function useCommandPalette() {
  function registerGroup(group: CommandGroup) {
    const index = groups.value.findIndex(g => g.id === group.id)
    if (index > -1) groups.value[index] = group
    else groups.value.push(group)
  }

  function unregisterGroup(groupId: string) {
    groups.value = groups.value.filter(g => g.id !== groupId)
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return { isOpen, groups, registerGroup, unregisterGroup, close, toggle }
}
