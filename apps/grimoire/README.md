# Grimoire

Documentation site for Artificer Forge, built with [Docus 5](https://docus.dev) (Nuxt 4 + Nuxt Content + Nuxt UI).

## Commands

```bash
pnpm -F @artificer-forge/grimoire dev     # http://localhost:3000
pnpm -F @artificer-forge/grimoire build   # output in .output/
```

## Layout

```
apps/grimoire/
├── content/          # Markdown pages, one numbered folder per section
│   ├── index.md      # Landing page
│   └── NN.section/   # .navigation.yml + N.page.md
├── app/
│   ├── assets/css/main.css        # Palette (ivory / slate / book cloth) and font
│   └── components/content/        # MDC components usable in markdown
├── public/           # Images referenced from pages
├── app.config.ts     # Docus theme: header, colors, font
└── nuxt.config.ts    # Mermaid module, fonts
```

## Writing pages

See `CLAUDE.md` in this folder for the page format, callout syntax and link rules. Short version:

- Frontmatter `title` + `description`; no `# H1` in the body.
- Callouts: `::note`, `::tip`, `::warning`, `::caution`.
- Diagrams: fenced ```` ```mermaid ```` blocks.
- Links strip the numeric prefixes: `content/05.characters/3.controller.md` is `/characters/controller`.
