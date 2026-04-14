import { z } from 'zod'

export const StatusEffectIdSchema = z.enum([
  'poisoned',
  'stunned',
  'burning',
  'blessed',
  'hasted',
  'frozen',
])

export type StatusEffectId = z.infer<typeof StatusEffectIdSchema>
