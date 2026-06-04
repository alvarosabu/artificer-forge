import type { CheckRoll, DialogNode, ResolvedChoice } from '~/composables/useDialogEngine'

interface DialogTree {
  dialogId: string
  startNode: string
  nodes: Record<string, DialogNode>
}

interface DialogHistoryEntry {
  speaker: string | null
  text: string
  choiceText?: string
  check?: CheckRoll
}

export const useDialogStore = defineStore('dialog', () => {
  const engine = useDialogEngine()
  const gameStore = useGameStore()

  const activeTree = ref<DialogTree | null>(null)
  const currentNodeId = ref<string | null>(null)
  const speakerEntityId = ref<string | null>(null)
  const history = ref<DialogHistoryEntry[]>([])
  // Most recent skill-check result — used by the panel for a brief flash.
  const lastCheck = ref<CheckRoll | null>(null)
  let checkFlashTimer: ReturnType<typeof setTimeout> | null = null

  function flashCheck(roll: CheckRoll) {
    lastCheck.value = roll
    if (checkFlashTimer) clearTimeout(checkFlashTimer)
    // Auto-clear the flash so it doesn't linger across nodes. Client-only —
    // the dialog flow never runs during SSR.
    if (import.meta.client) {
      checkFlashTimer = setTimeout(() => {
        lastCheck.value = null
        checkFlashTimer = null
      }, 2500)
    }
  }

  const isOpen = computed(() => activeTree.value !== null && currentNodeId.value !== null)

  const currentNode = computed<DialogNode | null>(() => {
    if (!activeTree.value || !currentNodeId.value) return null
    return activeTree.value.nodes[currentNodeId.value] ?? null
  })

  const context = computed(() => engine.buildContext(speakerEntityId.value))

  const currentText = computed(() => {
    const node = currentNode.value
    if (!node) return ''
    return engine.resolveText(node, context.value)
  })

  const currentChoices = computed<ResolvedChoice[]>(() => {
    const node = currentNode.value
    if (!node) return []
    return engine.availableChoices(node, context.value).filter(c => !c.hide)
  })

  const currentSpeakerEntity = computed(() => {
    // Resolve speaker by entityId first, then by templateId from the node.
    if (speakerEntityId.value) {
      const e = gameStore.entities.get(speakerEntityId.value)
      if (e && e.templateId === currentNode.value?.speaker) return e
    }
    const tpl = currentNode.value?.speaker
    if (!tpl) return null
    for (const e of gameStore.entities.values()) {
      if (e.templateId === tpl) return e
    }
    return null
  })

  async function open(dialogId: string, speakerId: string | null) {
    // Ignore re-entry while a dialog is already active — prevents clobbering
    // live state (tree/history/leftover timers) on a repeated interaction.
    if (isOpen.value) return
    const tree = await queryCollection('dialogs')
      .where('dialogId', '=', dialogId)
      .first()
    if (!tree) {
      console.warn(`[dialog] tree not found: ${dialogId}`)
      return
    }
    activeTree.value = tree as unknown as DialogTree
    speakerEntityId.value = speakerId
    history.value = []
    lastCheck.value = null
    gameStore.inputBlocked = true
    enterNode(tree.startNode)
  }

  function enterNode(nodeId: string) {
    if (nodeId === '__end') {
      close()
      return
    }
    if (!activeTree.value || !activeTree.value.nodes[nodeId]) {
      console.warn(`[dialog] node not found: ${nodeId}`)
      close()
      return
    }
    currentNodeId.value = nodeId
    const node = activeTree.value.nodes[nodeId]

    // Push narrator/speaker line to history (after the previous choice resolved).
    history.value.push({
      speaker: node.speaker ?? null,
      text: engine.resolveText(node, context.value),
    })

    // Run on-entry effects (rare but supported).
    if (node.effects) {
      const { endDialog } = engine.applyEffects(node.effects, context.value)
      if (endDialog) close()
    }
  }

  function choose(choiceIndex: number) {
    const node = currentNode.value
    if (!node) return
    const resolved = engine.availableChoices(node, context.value)[choiceIndex]
    if (!resolved || !resolved.available) return

    const choice = resolved.raw

    // Record the player's spoken line in history.
    const last = history.value[history.value.length - 1]
    if (last) last.choiceText = choice.text

    // On-choose effects fire for every choice (pre-roll costs/triggers), so apply
    // them before branching — the skill-check path returns early below.
    if (choice.effects) {
      const { endDialog } = engine.applyEffects(choice.effects, context.value)
      if (endDialog) return close()
    }

    // Skill check path.
    if (choice.check) {
      const roll = engine.rollCheck(choice.check, context.value)
      flashCheck(roll)
      const branch = roll.success ? choice.onSuccess : choice.onFailure
      if (branch?.effects) {
        const { endDialog } = engine.applyEffects(branch.effects, context.value)
        if (endDialog) return close()
      }
      if (branch?.next) {
        return enterNode(branch.next)
      }
      return close()
    }

    // Plain branch path.
    if (choice.next) return enterNode(choice.next)
    close()
  }

  function close() {
    if (checkFlashTimer) {
      clearTimeout(checkFlashTimer)
      checkFlashTimer = null
    }
    activeTree.value = null
    currentNodeId.value = null
    speakerEntityId.value = null
    lastCheck.value = null
    gameStore.inputBlocked = false
  }

  return {
    // State
    activeTree,
    currentNodeId,
    speakerEntityId,
    history,
    lastCheck,
    // Getters
    isOpen,
    currentNode,
    currentText,
    currentChoices,
    currentSpeakerEntity,
    // Actions
    open,
    choose,
    close,
  }
})
