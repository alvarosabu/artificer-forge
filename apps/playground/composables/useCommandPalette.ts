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

export function useCommandPalette() {
  function registerGroup(group: CommandGroup) {
    const existingIdx = groups.value.findIndex(g => g.id === group.id)
    if (existingIdx > -1) {
      groups.value[existingIdx] = group
    }
    else {
      groups.value.push(group)
    }
  }

  function unregisterGroup(groupId: string) {
    const idx = groups.value.findIndex(g => g.id === groupId)
    if (idx > -1) {
      groups.value.splice(idx, 1)
    }
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    groups,
    registerGroup,
    unregisterGroup,
    open,
    close,
    toggle,
  }
}
