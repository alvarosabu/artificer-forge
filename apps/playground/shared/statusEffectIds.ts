import { z } from 'zod'

export const StatusEffectIdSchema = z.enum([
  'poisoned',
  'shocked',
  'burning',
  'blessed',
  'hasted',
  'frozen',
  'wet',
  'slowed',
  'warm',
])

export type StatusEffectId = z.infer<typeof StatusEffectIdSchema>
