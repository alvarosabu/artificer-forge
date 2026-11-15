export type InputDevice = 'keyboard' | 'xbox' | 'playstation'

/** The device the player touched last. Button hints draw their glyphs from it. */
export const useInputDevice = () => useState<InputDevice>('input-device', () => 'keyboard')

// 054c is Sony's USB vendor id. Browsers format Gamepad.id differently, but each one includes it or the product name.
const PLAYSTATION_PAD = /054c|dualsense|dualshock/i

/** Every pad that is not a PlayStation one gets the Xbox glyphs, the layout most PC pads copy. */
export function padFamily(pad: Gamepad): InputDevice {
  return PLAYSTATION_PAD.test(pad.id) ? 'playstation' : 'xbox'
}
