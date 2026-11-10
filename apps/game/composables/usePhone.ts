import type { InjectionKey, Ref } from 'vue'

export interface Phone {
  /** The player wants the phone out. Chamo puts it away when this turns false. */
  open: Ref<boolean>
  /** The phone key works: Chamo can take the phone out, or the phone is already out. */
  available: Ref<boolean>
  /** The phone is in Chamo's hand at full size, so the panel shows. */
  inHand: Ref<boolean>
  /** Chamo's facing angle around +Y, 0 facing +Z. The phone camera shot frames Chamo from the front. */
  yaw: Ref<number>
}

const PhoneKey: InjectionKey<Phone> = Symbol('phone')

export function providePhone() {
  const phone: Phone = { open: ref(false), available: ref(false), inHand: ref(false), yaw: ref(0) }
  provide(PhoneKey, phone)
  return phone
}

/** The phone shared by Chamo, who holds it, and the phone menu, which drives it. */
export function usePhone() {
  const phone = inject(PhoneKey, null)
  if (!phone) throw new Error('usePhone() needs providePhone() in the page')

  function toggle() {
    phone!.open.value = phone!.open.value ? false : phone!.available.value
  }

  return { ...phone, toggle }
}
