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
        class: z.string().optional(),
        level: z.number().optional(),
        race: z.string().optional(),
        // Character fields
        faction: z.string().optional(),
        team: z.enum(['player', 'ally', 'neutral', 'hostile']).optional(),
        controllable: z.boolean().optional(),
        recruitable: z.boolean().optional(),
        stats: z.record(z.number()).optional(),
        ai: z.object({
          behavior: z.string(),
        }).passthrough().optional(),
        portrait: z.string().optional(),
        model: z.string().optional(),
        rig: z.string().optional(),
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
        abilities: z.array(z.string()).optional(),
      }),
    }),
    classes: defineCollection({
      type: 'data',
      source: 'classes/*.yaml',
      schema: z.object({
        classId: z.string(),
        name: z.string(),
        emblem: z.string(),
        color: z.string(),
      }),
    }),
    abilities: defineCollection({
      type: 'data',
      source: 'abilities/*.yaml',
      schema: z.object({
        abilityId: z.string(),
        name: z.string(),
        type: z.enum(['melee', 'ranged-projectile', 'ranged-aoe', 'utility']),
        targeting: z.enum(['lock-on', 'ground', 'self']),
        icon: z.string().optional(),
        animations: z.object({
          targeting: z.string().optional(),
          execute: z.string(),
          recover: z.string().optional(),
        }),
        projectile: z.object({
          model: z.string().optional(),
          visual: z.string().optional(),
          color: z.string().optional(),
          speed: z.number(),
          arc: z.enum(['distance-based', 'straight', 'parabolic']),
        }).optional(),
        aoe: z.object({
          shape: z.enum(['circle', 'cone', 'line']),
          radius: z.number().optional(),
          width: z.number().optional(),
          angle: z.number().optional(),
        }).optional(),
        damage: z.object({
          dice: z.string(),
          type: z.string(),
          stat: z.string(),
        }).optional(),
        range: z.object({
          normal: z.number(),
          long: z.number().optional(),
        }).optional(),
        cost: z.enum(['action', 'bonusAction', 'free']),
        baseProjectiles: z.number().optional(),
        scalingStat: z.string().optional(),
        scalingThreshold: z.number().optional(),
      }),
    }),
  },
})
