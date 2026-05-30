// Per-character portrait backdrop. The texture URL is authored on the entity YAML
// (`portraitBackground`); this resolves it, falling back to a shared default so
// every portrait gets a backdrop even when a character doesn't define one.
export const DEFAULT_PORTRAIT_BACKGROUND = '/img/portraits/bgs/default.png'

// Resolve an entity's authored backdrop, falling back to the shared default.
export function resolvePortraitBackground(background?: string): string {
  return background || DEFAULT_PORTRAIT_BACKGROUND
}
