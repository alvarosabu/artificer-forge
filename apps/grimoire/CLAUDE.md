# Grimoire - Artificer Forge Documentation

Documentation site for the Artificer Forge game engine. Built with [Docus](https://docus.dev).

## Commands

```bash
pnpm -F @artificer-forge/grimoire dev    # Dev server
pnpm -F @artificer-forge/grimoire build  # Production build
```

## Content Structure

Replace default Docus content with engine documentation:

```
content/
├── index.md                    # Landing page
├── 1.getting-started/
│   ├── 1.introduction.md       # What is Artificer Forge
│   ├── 2.installation.md       # pnpm setup, workspace config
│   ├── 3.first-scene.md        # TresCanvas + basic 3D scene
│   └── 4.project-structure.md  # Monorepo architecture
│
├── 2.core-concepts/
│   ├── 1.tresjs-basics.md      # Declarative Three.js in Vue
│   ├── 2.scene-graph.md        # Parent/child relationships
│   ├── 3.materials-textures.md # PBR, textures, shaders
│   ├── 4.lighting.md           # Light types, shadows
│   └── 5.cameras-controls.md   # Camera setup, OrbitControls
│
├── 3.characters/
│   ├── 1.model-loading.md      # GLTF/GLB loading, useGLTF
│   ├── 2.animations.md         # Animation system, mixers
│   ├── 3.character-stats.md    # HP, abilities, attributes
│   └── 4.controllers.md        # Movement, input handling
│
├── 4.combat/
│   ├── 1.turn-system.md        # Initiative, turn order
│   ├── 2.actions.md            # Attack, defend, abilities
│   ├── 3.targeting.md          # Raycasting, selection
│   └── 4.effects.md            # Damage, buffs, status
│
├── 5.dialog/
│   ├── 1.conversation-trees.md # Dialog structure
│   ├── 2.choices.md            # Player choices, branching
│   └── 3.triggers.md           # NPC interaction, events
│
├── 6.inventory/
│   ├── 1.items.md              # Item definitions, types
│   ├── 2.equipment.md          # Slots, equip/unequip
│   └── 3.containers.md         # Chests, bags, storage
│
├── 7.components/
│   ├── 1.floor.md              # Ground planes, terrain
│   ├── 2.props.md              # Environmental objects
│   └── 3.effects.md            # Particles, VFX
│
└── 8.cookbook/
    ├── 1.isometric-camera.md   # Isometric view setup
    ├── 2.character-selection.md# Click-to-select pattern
    ├── 3.grid-movement.md      # Tile-based movement
    └── 4.dice-rolls.md         # D20 mechanics
```

## Writing Guidelines

- **Code examples**: Use Vue SFC with `<TresCanvas>` patterns
- **Live demos**: Embed playground examples where possible
- **Progressive**: Start simple, add complexity gradually
- **Practical**: Focus on game dev use cases, not abstract Three.js

## Frontmatter

Each page should have:

```yaml
---
title: Page Title
description: Brief description for SEO
---
```

## Components

Docus provides built-in components:

- `::code-group` - Tabbed code blocks
- `::alert` - Info, warning, danger boxes
- `::card` - Feature cards
- `::badge` - Version badges

See [Docus Components](https://docus.dev/api/components) for full list.
