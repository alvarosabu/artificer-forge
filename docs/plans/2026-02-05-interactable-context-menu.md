# Entity Context Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add right-click context menu system for all entity types (interactables, characters, items) with configurable actions based on entity type and properties.

**Architecture:** `Game.vue` owns context menu state and renders `EntityContextMenu` outside TresCanvas. A `useContextMenu` composable provides state via inject to child components. `useEntityActions` computes available actions per entity type. Entity components call `openContextMenu()` on right-click.

**Tech Stack:** Vue 3, Nuxt UI (`UDropdownMenu`), TresJS pointer events, provide/inject

---

### Task 1: Create useEntityActions composable

**Files:**
- Create: `apps/playground/composables/useEntityActions.ts`

**Step 1: Create the composable**

```typescript
import type { DropdownMenuItem } from '@nuxt/ui'
import type { EntityState } from '~/stores/game'

export interface EntityAction {
  id: string
  label: string
  icon: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  condition?: (entity: EntityState) => boolean
}

const interactableActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'use',
    label: 'Open',
    icon: 'i-heroicons-lock-open',
    condition: entity => !entity.locked && !entity.opened,
  },
  {
    id: 'close',
    label: 'Close',
    icon: 'i-heroicons-lock-closed',
    condition: entity => !entity.locked && !!entity.opened,
  },
  {
    id: 'lockpick',
    label: 'Lockpick',
    icon: 'i-heroicons-key',
    condition: entity => !!entity.locked,
  },
  {
    id: 'attack',
    label: 'Attack',
    icon: 'i-heroicons-fire',
    color: 'error',
    condition: entity => !!entity.destructible,
  },
]

const characterActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'talk',
    label: 'Talk',
    icon: 'i-heroicons-chat-bubble-left-right',
    condition: entity => !entity.hostile,
  },
  {
    id: 'attack',
    label: 'Attack',
    icon: 'i-heroicons-fire',
    color: 'error',
    condition: entity => !!entity.hostile || entity.faction !== 'player',
  },
  {
    id: 'follow',
    label: 'Follow',
    icon: 'i-heroicons-arrow-right',
    condition: entity => !entity.hostile && entity.faction === 'player',
  },
]

const itemActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'pickup',
    label: 'Pick Up',
    icon: 'i-heroicons-hand-raised',
  },
]

const actionsByType: Record<EntityState['type'], EntityAction[]> = {
  interactable: interactableActions,
  character: characterActions,
  item: itemActions,
}

export function useEntityActions() {
  function getActionsForEntity(entity: EntityState | null): DropdownMenuItem[][] {
    if (!entity) return []

    const actions = actionsByType[entity.type] ?? []

    const items: DropdownMenuItem[] = actions
      .filter(action => !action.condition || action.condition(entity))
      .map(action => ({
        label: action.label,
        icon: action.icon,
        color: action.color,
        onSelect: () => {},
        _actionId: action.id,
      }))

    return items.length ? [items] : []
  }

  return {
    getActionsForEntity,
    actionsByType,
  }
}
```

**Step 2: Commit**

```bash
git add apps/playground/composables/useEntityActions.ts
git commit -m "feat: add useEntityActions composable"
```

---

### Task 2: Create useContextMenu composable

**Files:**
- Create: `apps/playground/composables/useContextMenu.ts`

**Step 1: Create the composable**

```typescript
import type { InjectionKey } from 'vue'

export interface ContextMenuState {
  open: boolean
  entityId: string | null
  x: number
  y: number
}

export interface ContextMenuApi {
  state: ContextMenuState
  open: (entityId: string, x: number, y: number) => void
  close: () => void
  onAction: (handler: (action: string, entityId: string) => void) => void
}

export const ContextMenuKey: InjectionKey<ContextMenuApi> = Symbol('context-menu')

export function useContextMenuProvider() {
  const state = reactive<ContextMenuState>({
    open: false,
    entityId: null,
    x: 0,
    y: 0,
  })

  const actionHandlers = new Set<(action: string, entityId: string) => void>()

  function open(entityId: string, x: number, y: number) {
    state.entityId = entityId
    state.x = x
    state.y = y
    state.open = true
  }

  function close() {
    state.open = false
  }

  function onAction(handler: (action: string, entityId: string) => void) {
    actionHandlers.add(handler)
    onUnmounted(() => actionHandlers.delete(handler))
  }

  function emitAction(action: string, entityId: string) {
    actionHandlers.forEach(handler => handler(action, entityId))
  }

  const api: ContextMenuApi = {
    state,
    open,
    close,
    onAction,
  }

  provide(ContextMenuKey, api)

  return { state, open, close, emitAction }
}

export function useContextMenu() {
  const api = inject(ContextMenuKey)
  if (!api) {
    throw new Error('useContextMenu must be used within a Game component')
  }
  return api
}
```

**Step 2: Commit**

```bash
git add apps/playground/composables/useContextMenu.ts
git commit -m "feat: add useContextMenu composable with provide/inject"
```

---

### Task 3: Create EntityContextMenu component

**Files:**
- Create: `apps/playground/components/EntityContextMenu.vue`

**Step 1: Create the component**

```vue
<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContextMenuState } from '~/composables/useContextMenu'

const props = defineProps<{
  state: ContextMenuState
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  action: [action: string, entityId: string]
}>()

const gameStore = useGameStore()
const { getActionsForEntity } = useEntityActions()

const open = computed({
  get: () => props.state.open,
  set: (value: boolean) => emit('update:open', value),
})

const entity = computed(() => {
  if (!props.state.entityId) return null
  return gameStore.getEntity(props.state.entityId)
})

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const items = getActionsForEntity(entity.value)

  return items.map(group =>
    group.map(item => ({
      ...item,
      onSelect: () => handleAction((item as any)._actionId),
    })),
  )
})

function handleAction(action: string) {
  if (props.state.entityId) {
    emit('action', action, props.state.entityId)
  }
  open.value = false
}
</script>

<template>
  <div
    v-if="open && menuItems.length"
    class="fixed z-50"
    :style="{ left: `${state.x}px`, top: `${state.y}px` }"
  >
    <UDropdownMenu
      v-model:open="open"
      :items="menuItems"
    >
      <template #default>
        <span class="sr-only">Context menu trigger</span>
      </template>
    </UDropdownMenu>
  </div>
</template>
```

**Step 2: Commit**

```bash
git add apps/playground/components/EntityContextMenu.vue
git commit -m "feat: add EntityContextMenu component"
```

---

### Task 4: Update Game.vue to manage context menu

**Files:**
- Modify: `apps/playground/components/Game.vue`

**Step 1: Update Game.vue**

```vue
<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

const gameStore = useGameStore()

const { state, close, emitAction } = useContextMenuProvider()

function handlePointerMissed() {
  close()
}

function handleContextMenuAction(action: string, entityId: string) {
  emitAction(action, entityId)
}

const createWebGPURenderer = (ctx: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
  return renderer
}
</script>

<template>
  <TresCanvas
    clear-color="#020420"
    window-size
    :renderer="createWebGPURenderer"
    @pointer-missed="handlePointerMissed"
  >
    <slot />
  </TresCanvas>
  <EntityContextMenu
    :state="state"
    @update:open="state.open = $event"
    @action="handleContextMenuAction"
  />
</template>
```

**Step 2: Commit**

```bash
git add apps/playground/components/Game.vue
git commit -m "feat(game): manage context menu state and render EntityContextMenu"
```

---

### Task 5: Add contextmenu to Interactable

**Files:**
- Modify: `apps/playground/components/Interactable.vue`

**Step 1: Import and use context menu**

Add after other composable calls:

```typescript
const { open: openContextMenu } = useContextMenu()
```

**Step 2: Add contextmenu handler**

Add after `handleClick`:

```typescript
function handleContextMenu(event: TresPointerEvent) {
  event.nativeEvent.preventDefault()
  openContextMenu(
    props.entityId,
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  )
}
```

**Step 3: Bind to primitive**

Update the `<primitive>` element:

```vue
<primitive
  v-if="scene"
  :object="scene"
  @click="handleClick"
  @contextmenu="handleContextMenu"
  @pointerenter="isHovering = true"
  @pointerleave="isHovering = false"
>
```

**Step 4: Commit**

```bash
git add apps/playground/components/Interactable.vue
git commit -m "feat(interactable): open context menu on right-click"
```

---

### Task 6: Add contextmenu to Character

**Files:**
- Modify: `apps/playground/components/Character.vue`

**Step 1: Import and use context menu**

Add after other composable calls:

```typescript
const { open: openContextMenu } = useContextMenu()
```

**Step 2: Add contextmenu handler**

```typescript
function handleContextMenu(event: TresPointerEvent) {
  event.nativeEvent.preventDefault()
  openContextMenu(
    props.entityId,
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  )
}
```

**Step 3: Bind to the model**

Add `@contextmenu="handleContextMenu"` to the primitive/group element that receives pointer events.

**Step 4: Commit**

```bash
git add apps/playground/components/Character.vue
git commit -m "feat(character): open context menu on right-click"
```

---

### Task 7: Add destructible to EntityState and schema

**Files:**
- Modify: `apps/playground/stores/game.ts`
- Modify: `apps/playground/content.config.ts`

**Step 1: Add destructible to EntityState**

In `EntityState` interface under `// Interactable-specific`:

```typescript
// Interactable-specific
locked?: boolean
opened?: boolean
destructible?: boolean
```

**Step 2: Add destructible to spawnFromTemplate**

Add to entityState object:

```typescript
destructible: template.destructible,
```

**Step 3: Add destructible to content schema**

In `content.config.ts`, add:

```typescript
destructible: z.boolean().optional(),
```

**Step 4: Commit**

```bash
git add apps/playground/stores/game.ts apps/playground/content.config.ts
git commit -m "feat: add destructible property to EntityState and schema"
```

---

### Task 8: Handle context menu actions in experience.vue

**Files:**
- Modify: `apps/playground/pages/model/experience.vue`

**Step 1: Register action handler**

Add after other setup code:

```typescript
const { onAction } = useContextMenu()

onAction((action, entityId) => {
  const entity = gameStore.getEntity(entityId)
  if (!entity) return

  switch (action) {
    case 'examine':
      console.log('Examine:', entityId)
      break
    case 'use':
    case 'close':
      handleInteractableClick(entityId)
      break
    case 'lockpick':
      console.log('Lockpick:', entityId)
      break
    case 'attack':
      console.log('Attack:', entityId)
      break
    case 'talk':
      console.log('Talk:', entityId)
      break
    case 'follow':
      console.log('Follow:', entityId)
      break
    case 'pickup':
      console.log('Pickup:', entityId)
      break
  }
})
```

**Step 2: Commit**

```bash
git add apps/playground/pages/model/experience.vue
git commit -m "feat(experience): handle context menu actions"
```

---

## Final Verification

1. Right-click chest → menu at cursor with Examine, Open, Attack
2. Click empty space → menu closes
3. Select "Open" → character walks to chest, opens it
4. Right-click opened chest → shows "Close" instead of "Open"
5. Right-click character → shows Talk/Attack based on faction
6. Add `locked: true` to chest YAML → shows "Lockpick" instead of Open
