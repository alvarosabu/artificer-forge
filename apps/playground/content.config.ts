import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    scenes: defineCollection({
      type: 'data',
      source: 'scenes/*.yaml',
      schema: z.object({
        sceneId: z.string(),
        name: z.string(),
        spawnPoints: z.record(z.object({
          x: z.number(),
          y: z.number(),
          z: z.number(),
        })),
        exits: z.array(z.object({
          id: z.string(),
          target: z.string(),
          position: z.object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          }),
        })).optional(),
        entities: z.array(z.object({
          templateId: z.string(),
          position: z.object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          }),
          rotation: z.object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          }).optional(),
          overrides: z.record(z.any()).optional(),
        })),
      }),
    }),
    entities: defineCollection({
      type: 'data',
      source: 'entities/**/*.yaml',
      schema: z.object({
        templateId: z.string(),
        type: z.enum(['character', 'item', 'interactable']),
        subtype: z.string().optional(),
        name: z.string(),
        // Character fields
        faction: z.string().optional(),
        hostile: z.boolean().optional(),
        controllable: z.boolean().optional(),
        stats: z.record(z.number()).optional(),
        ai: z.object({
          behavior: z.string(),
        }).passthrough().optional(),
        model: z.string().optional(),
        // Interactable animations: code-driven transforms
        animations: z.object({
          default: z.string(),
          states: z.record(z.object({
            target: z.string(),
            rotation: z.object({
              x: z.number(),
              y: z.number(),
              z: z.number(),
            }).optional(),
            position: z.object({
              x: z.number(),
              y: z.number(),
              z: z.number(),
            }).optional(),
          })),
        }).optional(),
        // Item fields
        damage: z.object({
          dice: z.string(),
          type: z.string(),
        }).optional(),
        properties: z.array(z.string()).optional(),
        range: z.object({
          normal: z.number(),
          long: z.number(),
        }).optional(),
        effect: z.object({
          type: z.string(),
          dice: z.string().optional(),
          bonus: z.number().optional(),
        }).optional(),
        weight: z.number().optional(),
        value: z.number().optional(),
        usable: z.boolean().optional(),
        stackable: z.boolean().optional(),
        maxStack: z.number().optional(),
        requirements: z.record(z.number()).optional(),
        // Interactable fields
        locked: z.boolean().optional(),
        lockDifficulty: z.number().optional(),
        hp: z.number().optional(),
        maxHp: z.number().optional(),
        destructible: z.boolean().optional(),
        lootTable: z.array(z.object({
          id: z.string(),
          quantity: z.union([z.number(), z.array(z.number())]).optional(),
          chance: z.number(),
        })).optional(),
        equipment: z.object({
          mainHand: z.string().optional(),
          offHand: z.string().optional(),
        }).optional(),
      }),
    }),
  },
})
