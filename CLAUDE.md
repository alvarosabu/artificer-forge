# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pnpm monorepo for 3D web experiments using Nuxt + TresJS (Vue-based Three.js).

## Commands

```bash
# Development (run from app directory or use -F flag)
pnpm -F model-playground dev      # Dev server at localhost:3000
pnpm -F model-playground build    # Production build
pnpm -F model-playground preview  # Preview prod build
pnpm -F model-playground generate # Static site generation

# Linting
pnpm -F model-playground lint
pnpm -F model-playground lint:fix
```

## Architecture

```
game-lab/
├── apps/
│   └── model-playground/    # Nuxt 4 + TresJS app
│       ├── pages/           # File-based routing
│       ├── components/      # Vue/TresJS components
│       └── public/          # Static assets
├── packages/                # Shared packages (empty)
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
