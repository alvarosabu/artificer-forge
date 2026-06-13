import { z } from 'zod'

export const StatusEffectIdSchema = z.enum([
  'poisoned',
  'stunned',
  'burning',
  'blessed',
  'hasted',
  'frozen',
  'wet',
  'slowed',
])

export type StatusEffectId = z.infer<typeof StatusEffectIdSchema>
