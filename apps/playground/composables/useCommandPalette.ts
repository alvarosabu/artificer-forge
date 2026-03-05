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

export interface CommandPage {
  id: string
  label: string
  groups: CommandGroup[]
}

const isOpen = ref(false)
const groups = ref<CommandGroup[]>([])
const pageStack = ref<CommandPage[]>([])

export function useCommandPalette() {
  const currentGroups = computed(() =>
    pageStack.value.length > 0
      ? pageStack.value[pageStack.value.length - 1]!.groups
      : groups.value,
  )

  const breadcrumbs = computed(() => pageStack.value.map(p => p.label))

  function pushPage(page: CommandPage) {
    pageStack.value.push(page)
  }

  function popPage() {
    pageStack.value.pop()
  }

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
    pageStack.value = []
  }

  function toggle() {
    if (isOpen.value) {
      close()
    }
    else {
      open()
    }
  }

  return {
    isOpen,
    groups,
    currentGroups,
    breadcrumbs,
    pushPage,
    popPage,
    registerGroup,
    unregisterGroup,
    open,
    close,
    toggle,
  }
}
