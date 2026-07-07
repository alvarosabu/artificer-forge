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
        sex: z.enum(['M', 'F']).optional(),
        // Modular cosmetics — presence switches rendering from `model` (single
        // GLB) to modular assembly. Part ids come from the generated part
        // manifest (modules/part-manifest.ts). Armor is NOT part of appearance:
        // it derives from equipped items (modular.assets below).
        appearance: z.object({
          body: z.string(),
          head: z.string(),
          hair: z.string().nullable().optional(),
          beard: z.string().nullable().optional(),
          eyebrows: z.string().nullable().optional(),
          horns: z.string().nullable().optional(),
          skinColor: z.string(),
          hairColor: z.string(),
          hornColorA: z.string().optional(),
          hornColorB: z.string().optional(),
          hornPattern: z.enum(['gradient', 'repeated', 'solid']).optional(),
          hornWeight: z.number().optional(),
          equipmentTint: z.record(z.string()).optional(),
          // Per-body-segment material swap (e.g. a ghostly arm). `material`
          // names a factory registered via registerSegmentMaterials; sided
          // segment keys (armR) hit one side, side-agnostic (arm) hit both.
          segmentMaterials: z.array(z.object({
            segments: z.array(z.string()),
            material: z.string(),
            params: z.record(z.any()).optional(),
          })).optional(),
        }).optional(),
        faction: z.string().optional(),
        team: z.enum(['player', 'ally', 'neutral', 'hostile']).optional(),
        controllable: z.boolean().optional(),
        recruitable: z.boolean().optional(),
        stats: z.record(z.number()).optional(),
        ai: z.object({
          behavior: z.string(),
        }).passthrough().optional(),
        portrait: z.string().optional(),
        // Backdrop texture behind the character in its generated portrait.
        portraitBackground: z.string().optional(),
        icon: z.string().optional(),
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
        armor: z.object({
          physical: z.number().optional(),
          magical: z.number().optional(),
        }).optional(),
        // Modular-character equip rendering: which body segments this piece hides
        // when worn. Keys are side-agnostic body-segment names (expanded to L/R at
        // runtime). See components/CharacterPreview.vue body assembly.
        modular: z.object({
          slot: z.enum(['helmet', 'armor', 'trousers', 'gauntlets', 'boots']),
          hides: z.array(z.enum(['head', 'torso', 'hips', 'arm', 'hand', 'leg', 'foot'])),
          // Fitted mesh per body sex; `any` = unisex asset. Resolution:
          // assets[entity.sex] ?? assets.any (miss = piece renders nothing).
          assets: z.object({
            M: z.string().optional(),
            F: z.string().optional(),
            any: z.string().optional(),
          }).optional(),
        }).optional(),
        // Palette-atlas tinting: `base` is the default atlas (also the GLB's embedded
        // map); each `tints` entry is an alternate recolored atlas swapped onto the
        // material's map. See components/CharacterPreview.vue armor tinting.
        texture: z.object({
          base: z.string(),
          tints: z.array(z.object({
            id: z.string(),
            label: z.string(),
            map: z.string(),
          })).optional(),
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
          helmet: z.string().optional(),
          armor: z.string().optional(),
          trousers: z.string().optional(),
          gauntlets: z.string().optional(),
          boots: z.string().optional(),
          amulet: z.string().optional(),
          ring1: z.string().optional(),
          ring2: z.string().optional(),
        }).optional(),
        equipmentSlots: z.array(z.enum([
          'mainHand',
          'offHand',
          'helmet',
          'armor',
          'trousers',
          'gauntlets',
          'boots',
          'amulet',
          'ring1',
          'ring2',
        ])).optional(),
        abilities: z.array(z.string()).optional(),
        dialogId: z.string().optional(),
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
    damageType: defineCollection({
      type: 'data',
      source: 'damage-types/*.yaml',
      schema: z.object({
        damageTypeId: z.string(),
        label: z.string(),
        armorType: z.enum(['physical', 'magical']),
        color: z.string(),
        icon: z.string(),
      }),
    }),
    dialogs: defineCollection({
      type: 'data',
      source: 'dialogs/*.yaml',
      schema: z.object({
        dialogId: z.string(),
        startNode: z.string(),
        nodes: z.record(z.object({
          speaker: z.string().optional(),          // entity templateId of speaker (omit = narrator)
          text: z.string(),
          textVariants: z.array(z.object({
            if: z.record(z.any()),                 // condition object — same shape as choice.conditions[i]
            text: z.string(),
          })).optional(),
          cameraShot: z.enum(['three-quarter', 'over-shoulder', 'closeup', 'wide', 'two-shot']).optional(),
          cameraTarget: z.string().optional(),     // entityId override (default = speaker)
          choices: z.array(z.object({
            text: z.string(),
            tagPrefix: z.string().optional(),      // e.g. SCHOLAR, PERSUASION — rendered as "[TAG] ..."
            conditions: z.array(z.record(z.any())).optional(),  // AND across array; each entry is one predicate
            check: z.object({
              skill: z.string(),
              dc: z.number(),
              advantage: z.boolean().optional(),
            }).optional(),
            next: z.string().optional(),
            onSuccess: z.object({
              next: z.string().optional(),
              effects: z.array(z.record(z.any())).optional(),
            }).optional(),
            onFailure: z.object({
              next: z.string().optional(),
              effects: z.array(z.record(z.any())).optional(),
            }).optional(),
            effects: z.array(z.record(z.any())).optional(),
            lockedDisplay: z.enum(['hide', 'lock']).optional(),
          })).optional(),
          effects: z.array(z.record(z.any())).optional(),  // run on node entry
        })),
      }),
    }),
    statusEffect: defineCollection({
      type: 'data',
      source: 'status-effects/*.yaml',
      schema: z.object({
        // z.string() instead of StatusEffectIdSchema — Nuxt Content can't resolve imported
        // Zod schemas and puts them in meta JSON instead of creating a column
        statusEffectId: z.string(),
        label: z.string(),
        type: z.enum(['buff', 'debuff', 'dot', 'cc']),
        armorGate: z.enum(['physical', 'magical', 'none']),
        // Painful effects trigger the periodic hurt animation while active
        flinch: z.boolean(),
        color: z.string(),
        bgColor: z.string(),
        icon: z.string(),
      }),
    }),
  },
})
