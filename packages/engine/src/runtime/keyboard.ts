// Shared keyboard helpers for the engine's global hotkeys. The HUD uses
// @vueuse/onKeyStroke (window-level) rather than Nuxt UI's defineShortcuts so
// components stay package-portable — but onKeyStroke has no focus awareness, so
// global shortcuts must bail when the user is typing. isEditableTarget restores
// the input-focus guard defineShortcuts gave us for free.

/**
 * True when a keyboard event originates from an editable element — a text
 * input, textarea, select, or contentEditable region. Global shortcuts should
 * return early on these so typing isn't hijacked.
 */
export function isEditableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) { return false }
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
