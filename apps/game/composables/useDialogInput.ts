import { useEventListener, useRafFn } from '@vueuse/core'
import { isEditableTarget } from '@artificer-forge/engine/runtime'
import type { Dialog } from './useDialog'

const CONFIRM_KEYS = new Set(['Enter', 'Space', 'KeyE'])
const UP_KEYS = new Set(['ArrowUp', 'KeyW'])
const DOWN_KEYS = new Set(['ArrowDown', 'KeyS'])
const CLOSE_KEY = 'Escape'

// Button indices of the W3C "standard" gamepad mapping.
const PAD_A = 0
const PAD_Y = 3
const PAD_UP = 12
const PAD_DOWN = 13
const PAD_BUTTONS = [PAD_A, PAD_Y, PAD_UP, PAD_DOWN]
const STICK_THRESHOLD = 0.5
const STICK_REPEAT_DELAY = 0.35
const STICK_REPEAT_RATE = 0.12

// Chamo reads a queued press on his next physics step. Two clear frames make sure that step ran while still locked.
const CLEAR_FRAMES = 2

const choiceDigit = (code: string) => (/^Digit[1-9]$/.test(code) ? Number(code.slice(5)) - 1 : -1)

const isDialogKey = (code: string) =>
  CONFIRM_KEYS.has(code) || UP_KEYS.has(code) || DOWN_KEYS.has(code) || code === CLOSE_KEY || choiceDigit(code) >= 0

function firstGamepad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  return navigator.getGamepads().find(pad => pad?.connected) ?? null
}

/** Keyboard and gamepad control of the open dialog, and the release guard that keeps its last press away from Chamo. */
export function useDialogInput(dialog: Dialog) {
  const heldKeys = new Set<string>()

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (!dialog.isOpen.value || isEditableTarget(event) || !isDialogKey(event.code)) return
    heldKeys.add(event.code)
    event.preventDefault()
    if (event.repeat) return

    if (CONFIRM_KEYS.has(event.code)) dialog.confirm()
    else if (UP_KEYS.has(event.code)) dialog.moveSelection(-1)
    else if (DOWN_KEYS.has(event.code)) dialog.moveSelection(1)
    else if (event.code === CLOSE_KEY) dialog.close()
    else dialog.choose(choiceDigit(event.code))
  })
  useEventListener('keyup', (event: KeyboardEvent) => heldKeys.delete(event.code))
  useEventListener('blur', () => heldKeys.clear())

  // A button acts only after it was seen up while the dialog is open, so the Y press that opened the dialog does not also confirm.
  const armed = new Set<number>()
  let stickDirection = 0
  let stickFresh = false
  let stickTimer = 0
  let clearFrames = 0

  watch(dialog.isOpen, (open) => {
    if (!open) return
    armed.clear()
    stickFresh = false
  })

  function pollPad(pad: Gamepad, delta: number) {
    const open = dialog.isOpen.value
    for (const index of PAD_BUTTONS) {
      const pressed = !!pad.buttons[index]?.pressed
      if (!open) continue
      if (!pressed) {
        armed.add(index)
        continue
      }
      if (!armed.delete(index)) continue
      if (index === PAD_A || index === PAD_Y) dialog.confirm()
      else dialog.moveSelection(index === PAD_UP ? -1 : 1)
    }

    const stickY = pad.axes[1] ?? 0
    const direction = stickY < -STICK_THRESHOLD ? -1 : stickY > STICK_THRESHOLD ? 1 : 0
    if (direction !== stickDirection) {
      stickDirection = direction
      stickFresh = open
      stickTimer = STICK_REPEAT_DELAY
      if (open && direction) dialog.moveSelection(direction)
    }
    else if (open && direction && stickFresh) {
      stickTimer -= delta
      if (stickTimer <= 0) {
        stickTimer = STICK_REPEAT_RATE
        dialog.moveSelection(direction)
      }
    }
  }

  useRafFn(({ delta }) => {
    const pad = firstGamepad()
    if (pad) pollPad(pad, delta / 1000)

    if (!dialog.releasePending.value) return
    const padHeld = !!pad && (pad.buttons[PAD_A]?.pressed || pad.buttons[PAD_Y]?.pressed)
    if (heldKeys.size > 0 || padHeld) {
      clearFrames = 0
      return
    }
    if (++clearFrames >= CLEAR_FRAMES) {
      clearFrames = 0
      dialog.releasePending.value = false
    }
  })
}
