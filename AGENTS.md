# Artificer Forge

pnpm monorepo for 3D RPG games using **Nuxt 4 + TresJS** (Vue-based Three.js).

## Quick Reference

| App/Package | Scope | Purpose |
|-------------|-------|---------|
| `apps/playground` | `@artificer-forge/playground` | Experiments sandbox |
| `apps/game` | `@artificer-forge/game` | Tabletop RPG adventure game |
| `apps/grimoire` | `@artificer-forge/grimoire` | Documentation (Docus) |
| `packages/engine` | `@artificer-forge/engine` | Game runtime: `core` rules, `runtime` stores/systems/scene, `ui` HUD |
| `packages/vfx` | `@artificer-forge/vfx` | Visual effects: damage numbers, reticle, particles, materials |
| `packages/post-processing` | `@artificer-forge/post-processing` | Effect composer and passes (bloom, DOF, outline, godrays, tilt-shift) |
| `packages/dialog-editor` | `@artificer-forge/dialog-editor` | Nuxt module: visual dialog graph editor |
| `packages/assets` | `@artificer-forge/assets` | Shared 3D assets (models/textures) + part manifest, consumed via Nuxt module |
| `packages/utils` | `@artificer-forge/utils` | Small shared helpers (dice rolls) |

## Commands

```bash
# Dev servers
pnpm -F @artificer-forge/playground dev
pnpm -F @artificer-forge/grimoire dev

# Build
pnpm -F @artificer-forge/playground build
pnpm -F @artificer-forge/components build

# Lint
pnpm -F @artificer-forge/playground lint:fix
```

## Tech Stack

| Tech | Usage |
|------|-------|
| Nuxt 4 | Full-stack Vue framework |
| TresJS | Declarative Three.js (`<TresCanvas>`, `<TresMesh>`) |
| @tresjs/cientos | Pre-built 3D helpers (OrbitControls, useGLTF) |
| @nuxt/content | YAML-based entity templates |
| Pinia | Runtime game state (entities, party, inventory) |
| pnpm catalogs | Centralized versions in `pnpm-workspace.yaml` |

## Core Patterns

### Entity System
- **Templates**: YAML in `content/entities/` → queried via `queryCollection('entities')`
- **Runtime**: Pinia store (`useGameStore`) holds spawned instances
- **Flow**: `spawnFromTemplate(templateId, position)` → EntityState in store → rendered in scene

### Component Architecture
- **Smart** (experience pages): Access store, manage entity lifecycle
- **Dumb** (Character, etc.): Receive props, render model

## Key Files

| File | Purpose |
|------|---------|
| `packages/engine/src/runtime/stores/game.ts` | Central state: entities, party, inventory, flags |
| `packages/engine/src/runtime/useCharacterController.ts` | Movement facade (pointer/keyboard modes) |
| `packages/engine/src/runtime/usePointerController.ts` | Click-to-move implementation |
| `packages/engine/src/runtime/useCharacterAnimations.ts` | Animation control |
| `packages/engine/src/runtime/components/Character.vue` | Model rendering (dumb) |
| `apps/playground/content.config.ts` | Nuxt Content schema for entities |
| `apps/playground/content/entities/**/*.yaml` | Entity templates (characters, items, interactables) |
| `apps/playground/composables/useEntityTemplates.ts` | Template query helpers |

## Nuxt Content v3 Notes

```ts
// Query templates (NOT queryContent)
const template = await queryCollection('entities')
  .where('templateId', '=', 'ranger')
  .first()
```

⚠️ `id` field is reserved for file path. Use `templateId` for custom IDs.

## Dev Philosophy

**Playground → stabilize → extract to packages → document in grimoire**

## External References

- **Bruno Simon's portfolio (Folio 2025)**: local checkout at `/Users/alvarosabu/Projects/brunos-portfolio` — ALWAYS read this source (shaders in `sources/Game/`) when checking "how Bruno did it" (grading, sun shade, fog/sky, grass, sun reflection); do not rely on the older public `infinite-world` GitHub repo or memory

## Domain Vocabulary

Before naming a domain concept in code, specs, tickets or reviews, read `CONTEXT-MAP.md` and the `CONTEXT.md` of the package you are working in. Use their terms and treat the `_Avoid_` lists as banned synonyms.

## Agent Configuration

Instructions, skills and hooks are shared by Claude Code, Codex and Cursor. Edit the canonical copy only:

- **Instructions**: `AGENTS.md` at the root and inside each app. Every `CLAUDE.md` is a one-line `@AGENTS.md` import so Claude Code reads the same file.
- **Skills**: `.agents/skills/<name>/SKILL.md`. Codex and Cursor read this folder directly; `.claude/skills` is a symlink to it.
- **Hooks**: scripts live in `.agents/hooks/`. They are wired from `.claude/settings.json`, `.codex/hooks.json` and `.cursor/hooks.json`.
