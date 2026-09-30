import { isEditableTarget } from '@artificer-forge/engine/runtime'

export interface PlayerInput {
  /** Right is +x, away from the camera is +y. The length is 0..1, so a half-pushed stick walks slower. */
  x: number
  y: number
  run: boolean
  /** True on the one read that follows a press. Holding the button does not jump again. */
  jump: boolean
}

// event.code is the physical key, so WASD stays in place on AZERTY and other layouts.
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

// Button indices of the W3C "standard" gamepad mapping, which Xbox and PlayStation pads report.
const PAD_BOTTOM = 0
const PAD_LEFT_STICK = 10
const STICK_DEADZONE = 0.15

function firstGamepad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  return navigator.getGamepads().find(pad => pad?.connected) ?? null
}

/**
 * Merges keyboard and the first gamepad into one PlayerInput.
 * The Gamepad API has no events for sticks or buttons, so call read() once per frame.
 */
export function usePlayerInput() {
  const held = new Set<string>()
  const input: PlayerInput = { x: 0, y: 0, run: false, jump: false }
  let jumpQueued = false
  let padJumpHeld = false
  let padStickHeld = false
  let padSprint = false

  function onKeyDown(event: KeyboardEvent) {
    if (isEditableTarget(event)) return
    if (event.code === 'Space' || event.code in MOVE_KEYS) event.preventDefault()
    if (event.code === 'Space' && !event.repeat) jumpQueued = true
    held.add(event.code)
  }

  function onKeyUp(event: KeyboardEvent) {
    held.delete(event.code)
  }

  // Keyup never arrives if focus leaves the window mid-press, so the key would stay held.
  function onBlur() {
    held.clear()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  })

  function read(): PlayerInput {
    let x = 0
    let y = 0
    for (const code of held) {
      const direction = MOVE_KEYS[code]
      if (!direction) continue
      x += direction[0]
      y += direction[1]
    }
    let run = held.has('ShiftLeft') || held.has('ShiftRight')
    let jump = jumpQueued
    jumpQueued = false

    const pad = firstGamepad()
    if (pad) {
      const stickX = pad.axes[0] ?? 0
      const stickY = pad.axes[1] ?? 0
      const magnitude = Math.hypot(stickX, stickY)
      if (magnitude > STICK_DEADZONE) {
        // Remap so speed starts at 0 just past the deadzone instead of jumping to 15%.
        const scale = Math.min(1, (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE)) / magnitude
        x += stickX * scale
        y -= stickY * scale // stick up reports -1
      }
      else {
        padSprint = false
      }

      // Holding the stick down while steering is hard, so a click toggles sprint until the stick returns to rest.
      const stickPressed = !!pad.buttons[PAD_LEFT_STICK]?.pressed
      if (stickPressed && !padStickHeld) padSprint = !padSprint
      padStickHeld = stickPressed

      const bottomPressed = !!pad.buttons[PAD_BOTTOM]?.pressed
      if (bottomPressed && !padJumpHeld) jump = true
      padJumpHeld = bottomPressed

      run ||= padSprint
    }

    // Diagonal keys, or keys plus stick, would otherwise move faster than straight input.
    const length = Math.hypot(x, y)
    if (length > 1) {
      x /= length
      y /= length
    }

    input.x = x
    input.y = y
    input.run = run
    input.jump = jump
    return input
  }

  return { read }
}
