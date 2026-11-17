import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const choice = z.object({
  text: z.string(),
  next: z.string().optional(),
})

const node = z.object({
  speaker: z.string().optional(),
  text: z.string(),
  choices: z.array(choice).optional(),
})

export default defineContentConfig({
  collections: {
    // A strict subset of the dialog YAML that the dialog editor and the engine read.
    dialogs: defineCollection({
      type: 'data',
      source: 'dialogs/*.yaml',
      schema: z.object({
        dialogId: z.string(),
        startNode: z.string(),
        nodes: z.record(z.string(), node),
      }),
    }),
  },
})
