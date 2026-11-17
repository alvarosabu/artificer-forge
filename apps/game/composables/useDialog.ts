import { useRafFn } from '@vueuse/core'
import type { Vector3Tuple } from 'three'
import type { InjectionKey, Ref } from 'vue'

export interface DialogSpeaker {
  /** Feet position of the speaker. The dialog camera pose frames the player and this point. */
  position: Vector3Tuple
}

const REVEAL_RATE = 40

function createDialog(trees: Ref<DialogTree[] | null | undefined>) {
  const tree = shallowRef<DialogTree | null>(null)
  const nodeId = ref<string | null>(null)
  const speakerPosition = shallowRef<Vector3Tuple | null>(null)
  const revealed = ref(0)
  const selected = ref(0)
  // True from close until the dialog input sees every dialog key and button up, so the closing press never reaches Chamo.
  const releasePending = ref(false)

  const node = computed(() => (tree.value && nodeId.value ? tree.value.nodes[nodeId.value] ?? null : null))
  const isOpen = computed(() => node.value !== null)
  const segments = computed(() => (node.value ? parseHighlights(node.value.text) : []))
  const textLength = computed(() => segments.value.reduce((sum, segment) => sum + segment.text.length, 0))
  const textDone = computed(() => revealed.value >= textLength.value)
  const choices = computed(() => node.value?.choices ?? [])
  const speaker = computed(() => (node.value?.speaker ? speakerName(node.value.speaker) : null))
  const inputLocked = computed(() => isOpen.value || releasePending.value)

  let revealCarry = 0
  useRafFn(({ delta }) => {
    if (!isOpen.value || textDone.value) return
    revealCarry += (delta / 1000) * REVEAL_RATE
    const step = Math.floor(revealCarry)
    revealCarry -= step
    revealed.value = Math.min(revealed.value + step, textLength.value)
  })

  function enter(id: string) {
    if (!tree.value?.nodes[id]) {
      console.warn(`[dialog] node not found: ${id}`)
      close()
      return
    }
    nodeId.value = id
    revealed.value = 0
    revealCarry = 0
    selected.value = 0
  }

  function open(dialogId: string, { position }: DialogSpeaker) {
    if (isOpen.value) return
    const found = trees.value?.find(candidate => candidate.dialogId === dialogId)
    if (!found) {
      console.warn(`[dialog] tree not found: ${dialogId}`)
      return
    }
    tree.value = found
    speakerPosition.value = position
    enter(found.startNode)
  }

  function close() {
    const wasOpen = isOpen.value
    tree.value = null
    nodeId.value = null
    speakerPosition.value = null
    // Set here, in the same tick, so the lock never drops between close and the input's next frame.
    if (wasOpen) releasePending.value = true
  }

  /** Shows the whole text if it is still appearing, else ends a node that has no choices. */
  function advance() {
    if (!isOpen.value) return
    if (!textDone.value) {
      revealed.value = textLength.value
      return
    }
    if (choices.value.length === 0) close()
  }

  function choose(index: number) {
    if (!isOpen.value || !textDone.value) return
    const choice = choices.value[index]
    if (!choice) return
    if (choice.next) enter(choice.next)
    else close()
  }

  /** The confirm button: completes the text, then takes the selected choice or ends the node. */
  function confirm() {
    if (textDone.value && choices.value.length > 0) choose(selected.value)
    else advance()
  }

  function moveSelection(step: number) {
    const count = choices.value.length
    if (!textDone.value || count === 0) return
    selected.value = (selected.value + step + count) % count
  }

  return {
    isOpen,
    node,
    speakerPosition: readonly(speakerPosition),
    speaker,
    segments,
    revealed: readonly(revealed),
    textDone,
    choices,
    selected,
    releasePending,
    inputLocked,
    open,
    close,
    advance,
    choose,
    confirm,
    moveSelection,
  }
}

export type Dialog = ReturnType<typeof createDialog>

const DialogKey: InjectionKey<Dialog> = Symbol('dialog')

/** Provides the page's dialog. `trees` are every dialog tree the page can open, loaded up front. */
export function provideDialog(trees: Ref<DialogTree[] | null | undefined>) {
  const dialog = createDialog(trees)
  provide(DialogKey, dialog)
  return dialog
}

/** The open dialog. NPCs call `open()` from their prompt; Chamo, the camera and the dialog UI read it. */
export function useDialog() {
  const dialog = inject(DialogKey, null)
  if (!dialog) throw new Error('useDialog() needs provideDialog() in the page')
  return dialog
}
