# Playground

Experiments sandbox for Artificer Forge. **Prototype here → extract to packages when stable.**

## Commands

```bash
pnpm -F @artificer-forge/playground dev
pnpm -F @artificer-forge/playground build
pnpm -F @artificer-forge/playground lint:fix
```

## Architecture

```
playground/
├── content/
│   └── entities/           # YAML entity templates
│       ├── characters/
│       │   ├── companions/ # ranger.yaml, player.yaml
│       │   └── enemies/    # goblin-scout.yaml
│       ├── items/          # longsword.yaml, healing-potion.yaml
│       └── interactables/  # chest-common.yaml
├── stores/
│   └── game.ts             # Central Pinia store
├── composables/
│   ├── useEntityTemplates.ts
│   ├── useCharacterAnimations.ts
│   ├── useCharacterController.ts  # Facade for movement controllers
│   └── usePointerController.ts    # Click-to-move implementation
├── components/
│   └── Character.vue       # Dumb model renderer
└── pages/
    ├── character/           # Character-only: movement + equipment
    │   └── experience.vue
    ├── interactable/        # Character + chest interaction
    │   └── experience.vue
    └── npc/                 # Character + NPC behavior
        └── experience.vue
```

## Entity System

### Templates (YAML → Nuxt Content)

```yaml
# content/entities/characters/companions/ranger.yaml
templateId: ranger          # NOT 'id' (reserved by Nuxt Content)
type: character
name: Elara the Ranger
model: /models/Ranger.glb   # single-GLB character
animations:
  idle: Idle_Neutral_A
  attack: Melee_1H_Attack_Chop
stats:
  hp: 28
  maxHp: 28
```

Characters can be **modular** instead of single-GLB: declare `sex` + `appearance`
(part ids + colors) instead of `model` — see `tav.yaml`. Part ids come from the
GENERATED manifest (`modules/part-manifest.ts` scans `public/models/characters`;
exceptions in `utils/partOverrides.ts`). Armor visuals derive from equipped items
(item YAML `modular.assets` per sex + `hides`), not from appearance.

### Runtime (Pinia Store)

```ts
const gameStore = useGameStore()

// Spawn from template
const entityId = await gameStore.spawnFromTemplate('ranger', { x: 0, y: 0, z: 0 })
gameStore.addToParty(entityId)

// Query entities
const characters = [...gameStore.entities.values()].filter(e => e.type === 'character')

// Update state
gameStore.updateEntity(entityId, { hp: 20 })
```

### Query Templates

```ts
// Nuxt Content v3 API
const template = await queryCollection('entities')
  .where('templateId', '=', 'ranger')
  .first()
```

## Key Interfaces

```ts
interface EntityState {
  id: string              // Runtime instance ID
  templateId: string      // Reference to YAML template
  type: 'character' | 'item' | 'interactable'
  position: { x, y, z }
  model?: string
  animations?: Record<string, string>
  hp?: number
  // ... see stores/game.ts for full interface
}
```

## Smart/Dumb Pattern

| Component | Role |
|-----------|------|
| `pages/*/experience.vue` | Smart: accesses store, spawns entities, filters for rendering |
| `components/Character.vue` | Dumb: receives `model`, `position` props, renders primitive |

## Common Tasks

| Task | How |
|------|-----|
| Add entity type | Add YAML in `content/entities/`, update schema in `content.config.ts` |
| Add animation | Add to template YAML `animations` map, use via `useCharacterAnimations` |
| Add character movement | Use `useCharacterController` with `mode: 'pointer'` or `'keyboard'` |
| Spawn entity | `gameStore.spawnFromTemplate(templateId, position)` |
| Track game state | `gameStore.setFlag('quest_done', true)` |

## Gotchas

- Restart dev server after adding/modifying YAML files or dropping part GLBs
- Part GLB filenames must parse: `{GEN|HUM|ELF|TIF}[_{M|F}]_..._{Variant}` (folder = slot); misnamed files are skipped with a warning
- `id` field in YAML is reserved → use `templateId`
- Wrap async components (Character) in `<Suspense>`
