# Grimoire

Documentation site for Artificer Forge. Built with **Docus 5** (Nuxt 4 + @nuxt/content + Nuxt UI) plus `@barzhsieh/nuxt-content-mermaid` for diagrams.

## Commands

```bash
pnpm -F @artificer-forge/grimoire dev
pnpm -F @artificer-forge/grimoire build
```

## Content Structure

One numbered folder per section; each folder has a `.navigation.yml` (`title`, `icon: i-lucide-*`). Pages are `N.slug.md`; zero-pad (`01.`) once a folder passes 9 pages, because ordering is a string sort on the prefix.

```
content/
├── index.md                  # Landing (u-page-hero + u-page-section; seo frontmatter only)
├── 01.getting-started/       # introduction, installation, quick-start
├── 02.engine-architecture/   # overview, three-layers, game-component, game-config
├── 03.core-concepts/         # game-store, scene-refs, commands, command-palette
├── 04.entities/              # overview, templates, rendering, scenes, interactables
├── 05.characters/            # model-loading, animations, controller, equipment,
│   └── 5.status-effects/     #   status-effects/* (one page per id), damage-numbers,
│                             #   modular-characters, assets-package
├── 06.portraits/             # overview, studio, bake-queue, signature
├── 07.actors/                # overview, player, npcs, enemies, companions, party-hud
├── 08.combat/                # overview, combat-store, action-bar, armor, abilities, aoe,
│                             #   projectiles, combat-system
├── 09.dialog/                # overview, dialog-engine, camera-director, dialog-panel, dialog-editor
├── 10.surfaces/              # overview, variants, surface-system, textures
├── 11.vfx/                   # overview, target-reticle, damage-numbers, materials, particles
├── 12.post-processing/       # overview, effect-composer, bloom, depth-of-field, outline, antialiasing
├── 13.environment/           # overview, grading, environment-store, day-cycle, wind, foliage,
│                             #   grass, flowers, trees, scatter, trample, terrain-heightmap,
│                             #   terrain-quadtree, terrain-material, water
└── 14.inventory/             # overview, store-api, ui-components, interactions,
                              #   stackables-and-weight, loot
```

URLs strip the numeric prefixes: `content/05.characters/3.controller.md` → `/characters/controller`; nested: `/characters/status-effects/overview`.

## Page Format

```yaml
---
title: Page Title
description: One-sentence SEO description
---

Content starts here. No h1.
```

> **Rule**: Docus renders `title` as the `h1`. Never add a `# Title` in the body.

## MDC Components

| Component | Usage |
|-----------|-------|
| `::note` / `::tip` / `::warning` / `::caution` | Callouts (Docus 5; `::alert` does not exist) |
| `::code-group` | Tabbed code blocks. Blank line before the first fence and between fences |
| ```` ```mermaid ```` | Diagrams, rendered by the mermaid module |
| `::collapsible` | Long lists (animation names) |
| `:status-effect-badge{id="burning"}` | Custom, `app/components/content/StatusEffectBadge.vue`; ids must match `content/status-effects/*.yaml` in the playground |
| `::u-page-hero` / `::u-page-section` / `:::u-page-feature` | Landing page only |

## Writing Guidelines

- Verify every prop, default, signature and path against the code before writing it. The source of truth is `packages/engine/src`, `packages/vfx/src`, `packages/post-processing/src`, `packages/dialog-editor/src`, `packages/assets/src` and `apps/playground`.
- Quote real YAML from `apps/playground/content/` rather than inventing examples.
- Vue SFC examples the way the playground does it: `index.vue` mounts `GameContextProvider`, `experience.vue` holds the scene (no `TresCanvas`).
- Import paths must be real: `@artificer-forge/engine/{core,runtime,ui}`, `@artificer-forge/vfx`, `@artificer-forge/post-processing`.
- Progressive: simple → complex. Game dev focus, not abstract Three.js theory.
- Tables for API surfaces: Name | Type | Default | Purpose.
- Say plainly when something is declared but not implemented (e.g. `over-capacity`, `cameraTarget`).
- Full audit of doc-vs-code drift (2026-08-28): `.claude/plans/2026-08-28-grimoire-docs-audit.md` at the repo root.
