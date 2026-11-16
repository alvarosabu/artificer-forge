export type InputDevice = 'keyboard' | 'xbox' | 'playstation'

const device = ref<InputDevice>('keyboard')

/** The device the player touched last. Button hints draw their glyphs from it. */
export const useInputDevice = () => readonly(device)

export function setInputDevice(next: InputDevice) {
  device.value = next
}

// 054c is Sony's vendor id. Do not add a bare "Wireless Controller": Xbox pads report "Xbox Wireless Controller".
const PLAYSTATION_PAD = /054c|dualsense|dualshock/i

/** Every pad that is not a PlayStation one gets the Xbox glyphs, the layout most PC pads copy. */
export function padFamily(pad: Gamepad): InputDevice {
  return PLAYSTATION_PAD.test(pad.id) ? 'playstation' : 'xbox'
}
