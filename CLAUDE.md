# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Artificer Forge** - pnpm monorepo for 3D adventure games using Nuxt + TresJS (Vue-based Three.js).

Package scope: `@artificer-forge/*`

## Commands

```bash
# Development (run from app directory or use -F flag)
pnpm -F @artificer-forge/playground dev      # Playground dev server
pnpm -F @artificer-forge/dnd-game dev        # D&D game dev server
pnpm -F @artificer-forge/grimoire dev        # Docs dev server

# Build
pnpm -F @artificer-forge/playground build
pnpm -F @artificer-forge/components build    # Build shared components

# Linting
pnpm -F @artificer-forge/playground lint
pnpm -F @artificer-forge/playground lint:fix
```

## Architecture

```
game-lab/
├── apps/
│   ├── playground/          # @artificer-forge/playground - Sandbox for experiments
│   ├── dnd-game/            # @artificer-forge/dnd-game - D&D adventure game
│   └── grimoire/            # @artificer-forge/grimoire - Documentation (Docus)
├── packages/
│   └── gamelab-components/  # @artificer-forge/components - Shared 3D components
└── pnpm-workspace.yaml      # Workspace + version catalogs
```

## Key Technologies

- **Nuxt 4** - Vue full-stack framework with SSR
- **TresJS** - Declarative Three.js for Vue (`<TresCanvas>`, `<TresMesh>`, etc.)
- **@tresjs/cientos** - Pre-built 3D components (OrbitControls, etc.)
- **pnpm catalogs** - Centralized dependency versions in `pnpm-workspace.yaml`

Named catalogs in `pnpm-workspace.yaml` - use `catalog:<name>` in package.json:
- `three:` - TresJS, Three.js, @types/three
- `nuxt:` - Nuxt, @nuxt/* modules
- `vue:` - Vue, Vue Router
- `eslint:` - ESLint
- `typescript:` - TypeScript
- `build:` - Build tools (tsdown)

## Development Philosophy

**Iterate in playground → stabilize → extract to packages**

1. Prototype new features in `@artificer-forge/playground` in isolation
2. Test and refine until the API feels right
3. Once stable, extract to appropriate shared package
4. Document the approach in `@artificer-forge/grimoire`

Playground is for experiments - expect throwaway code. Packages are for stable, reusable abstractions.

## Planned Package Structure

Domain-based packages (RPG toolkit with flexibility):

```
packages/
├── characters/      # @artificer-forge/characters
│                    # Model loading, animations, stats, controllers
├── combat/          # @artificer-forge/combat
│                    # Turn system, actions, targeting
├── dialog/          # @artificer-forge/dialog
│                    # Conversation trees, choices, branching
├── inventory/       # @artificer-forge/inventory
│                    # Items, equipment, containers
└── components/      # @artificer-forge/components (existing)
                     # Shared 3D components (Floor, terrain, props)
```

Each game app uses Nuxt UI for its own UI components - no shared UI package needed.
