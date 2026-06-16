// Canonical status-effect ids — genre data shared by the runtime store, HUD, and
// app content. Plain tuple + derived union (no zod dep); content validation in the
// app uses a string schema, so the zod schema this replaced had no external consumers.

export const STATUS_EFFECT_IDS = [
  'poisoned',
  'shocked',
  'burning',
  'blessed',
  'hasted',
  'frozen',
  'wet',
  'slowed',
  'warm',
] as const

export type StatusEffectId = typeof STATUS_EFFECT_IDS[number]
