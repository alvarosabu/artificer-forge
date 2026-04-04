# Grimoire

Documentation site for Artificer Forge. Built with **Nuxt UI Pro + @nuxt/content**.

## Commands

```bash
pnpm -F @artificer-forge/grimoire dev
pnpm -F @artificer-forge/grimoire build
```

## Content Structure

```
content/
├── index.md                      # Landing page (Nuxt UI Pro components)
├── 1.getting-started/
│   └── 1.introduction.md
├── 2.core-concepts/
│   └── 1.game-store.md           # Pinia store: entities, party, inventory
├── 3.entities/
│   ├── 1.overview.md             # Template vs instance pattern
│   ├── 2.templates.md            # YAML definitions, schema
│   └── 3.rendering.md            # Smart/dumb component pattern
├── 4.characters/
│   ├── 1.model-loading.md        # useGLTF, primitive
│   ├── 2.animations.md           # Animation system
│   └── 4.equipment.md            # Bone attachment with useEquipment
└── 8.environment/
    ├── 1.overview.md             # Environment systems overview
    └── 2.foliage.md              # Procedural billboard foliage
```

## Page Format

```yaml
---
title: Page Title
description: SEO description
---

Content starts here directly — no h1 needed.
```

> **Rule**: Docus automatically renders `title` from frontmatter as an `h1`. Never add a `# Title` heading in the markdown body — it will appear twice.

## Nuxt UI Pro Components

| Component | Usage |
|-----------|-------|
| `::u-page-hero` | Landing hero sections |
| `::u-page-section` | Content sections |
| `::u-page-feature` | Feature cards |
| `::alert{type="info"}` | Info/warning boxes |
| `::code-group` | Tabbed code blocks |

## Writing Guidelines

- Vue SFC code examples with `<TresCanvas>` patterns
- Progressive: simple → complex
- Game dev focus, not abstract Three.js theory
- Use `::alert{type="warning"}` for gotchas
