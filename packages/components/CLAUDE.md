# @artificer-forge/components

Shared 3D components for TresJS scenes.

## Commands

```bash
pnpm -F @artificer-forge/components build
pnpm -F @artificer-forge/components dev    # Watch mode
```

## Structure

```
src/
├── index.ts              # Public exports
└── components/
    └── Floor.vue         # Ground plane component
```

## Usage

```ts
import { Floor } from '@artificer-forge/components'
```

```vue
<template>
  <TresCanvas>
    <Floor />
  </TresCanvas>
</template>
```

## Build

Uses **tsdown** with `unplugin-vue` for Vue SFC compilation.

Peer deps: `three >= 0.170.0`, `vue >= 3.4.0`

## Adding Components

1. Create `.vue` file in `src/components/`
2. Export from `src/index.ts`
3. Run `pnpm -F @artificer-forge/components build`
