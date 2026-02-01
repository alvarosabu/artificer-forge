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
    └── model/
        └── experience.vue  # Smart scene manager
```

## Entity System

### Templates (YAML → Nuxt Content)

```yaml
# content/entities/characters/companions/ranger.yaml
templateId: ranger          # NOT 'id' (reserved by Nuxt Content)
type: character
name: Elara the Ranger
model: /models/Ranger.glb
animations:
  idle: Idle_Neutral_A
  attack: Melee_1H_Attack_Chop
stats:
  hp: 28
  maxHp: 28
```

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
| `pages/model/experience.vue` | Smart: accesses store, spawns entities, filters for rendering |
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

- Restart dev server after adding/modifying YAML files
- `id` field in YAML is reserved → use `templateId`
- Wrap async components (Character) in `<Suspense>`
