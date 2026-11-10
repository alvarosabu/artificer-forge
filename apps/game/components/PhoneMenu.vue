<script setup lang="ts">
import { useEventListener, useIntervalFn, useNow } from '@vueuse/core'
import { isEditableTarget } from '@artificer-forge/engine/runtime'
import { PHONE_APPS, PHONE_DOCK } from '~/utils/phoneApps'
import type { PhoneApp } from '~/utils/phoneApps'

const TOGGLE_KEY = 'KeyM'
const CLOSE_KEYS = new Set(['Escape', 'Backspace'])
const SELECT_KEYS = new Set(['Enter', 'Space', 'KeyE'])
const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
}
const COLUMNS = 3
const ROWS = 4
const PAGE_SIZE = COLUMNS * ROWS

const phone = usePhone()
const toast = useToast()

const pages = computed(() => {
  const result: PhoneApp[][] = []
  for (let i = 0; i < PHONE_APPS.length; i += PAGE_SIZE) result.push(PHONE_APPS.slice(i, i + PAGE_SIZE))
  return result
})
const page = ref(0)
const apps = computed(() => pages.value[page.value] ?? [])

const cursor = ref<{ dock: boolean, index: number }>({ dock: false, index: 0 })
const highlighted = computed(() => (cursor.value.dock ? PHONE_DOCK : apps.value)[cursor.value.index])

// Opens only when the phone reaches the hand while still wanted, so a close during take-out never flashes the panel.
const shown = ref(false)
watchEffect(() => {
  if (!phone.inHand.value) shown.value = false
  else if (phone.open.value) shown.value = true
})
// Put-away keeps the panel up for a moment, so input stops as soon as the player closes it.
const interactive = computed(() => shown.value && phone.open.value)

const now = useNow({ scheduler: tick => useIntervalFn(tick, 1000) })
const clock = computed(() => now.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
// The dock has more columns than the grid, so a vertical move lands on the nearest column across.
const remap = (column: number, from: number, to: number) => Math.round(column * (to - 1) / (from - 1))

function moveInDock(dx: number, dy: number) {
  if (dy < 0 && apps.value.length) {
    const lastRow = Math.ceil(apps.value.length / COLUMNS) - 1
    const column = remap(cursor.value.index, PHONE_DOCK.length, COLUMNS)
    cursor.value = { dock: false, index: Math.min(lastRow * COLUMNS + column, apps.value.length - 1) }
    return
  }
  cursor.value = { dock: true, index: clamp(cursor.value.index + dx, PHONE_DOCK.length - 1) }
}

function moveInGrid(dx: number, dy: number) {
  let column = cursor.value.index % COLUMNS + dx
  const row = Math.floor(cursor.value.index / COLUMNS) + dy
  if (column < 0 && page.value > 0) {
    page.value--
    column = COLUMNS - 1
  }
  else if (column >= COLUMNS && page.value < pages.value.length - 1) {
    page.value++
    column = 0
  }
  column = clamp(column, COLUMNS - 1)
  const rows = Math.ceil(apps.value.length / COLUMNS)
  if (row >= rows && PHONE_DOCK.length) {
    cursor.value = { dock: true, index: clamp(remap(column, COLUMNS, PHONE_DOCK.length), PHONE_DOCK.length - 1) }
    return
  }
  cursor.value = { dock: false, index: Math.min(clamp(row, rows - 1) * COLUMNS + column, apps.value.length - 1) }
}

function move(dx: number, dy: number) {
  if (cursor.value.dock) moveInDock(dx, dy)
  else moveInGrid(dx, dy)
}

function showPage(index: number) {
  page.value = index
  cursor.value = { dock: false, index: 0 }
}

function select(app: PhoneApp | undefined) {
  if (!app || !interactive.value) return
  toast.add({ title: app.label, description: 'Coming soon', icon: app.icon, duration: 2000 })
}

function close() {
  phone.open.value = false
}

// App icons select through the shared highlight (a page change drops their focus), so only the other buttons keep native Enter and Space.
const activatesItself = (target: EventTarget | null) =>
  target instanceof HTMLButtonElement && target.getAttribute('role') !== 'menuitem'

function onKeyDown(event: KeyboardEvent) {
  if (isEditableTarget(event)) return
  if (event.code === TOGGLE_KEY) {
    if (!event.repeat) phone.toggle()
    return
  }
  if (!interactive.value) return

  const direction = MOVE_KEYS[event.code]
  if (direction) {
    event.preventDefault()
    move(...direction)
  }
  else if (SELECT_KEYS.has(event.code) && !event.repeat) {
    if (event.code !== 'KeyE' && activatesItself(event.target)) return
    event.preventDefault()
    select(highlighted.value)
  }
  else if (CLOSE_KEYS.has(event.code) && !event.repeat) {
    event.preventDefault()
    close()
  }
}

useEventListener(window, 'keydown', onKeyDown)
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-10">
    <Transition
      enter-active-class="transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      enter-from-class="opacity-0 scale-50"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 scale-75"
    >
      <section
        v-if="shown"
        aria-label="Phone"
        class="pointer-events-auto absolute top-1/2 right-[calc(50%+4rem)] flex w-80 origin-right -translate-y-1/2 flex-col rounded-[2.75rem] bg-default bg-[radial-gradient(120%_70%_at_15%_0%,var(--color-iris-800),transparent_65%),radial-gradient(90%_60%_at_100%_100%,var(--color-iris-950),transparent_70%)] px-5 pt-3 pb-2 text-default shadow-2xl ring-1 ring-white/10 max-sm:right-auto max-sm:left-1/2 max-sm:origin-center max-sm:-translate-x-1/2 lg:right-[calc(50%+12rem)]"
      >
        <header class="grid grid-cols-[1fr_auto_1fr] items-center ps-3 pe-2 text-xs font-black">
          <span>{{ clock }}</span>
          <span class="h-7 w-20 rounded-full bg-black" aria-hidden="true" />
          <span class="flex items-center justify-end gap-1">
            <StatusIcon name="signal" />
            <StatusIcon name="wifi" />
            <StatusIcon name="battery" />
          </span>
        </header>

        <!-- fixed rows keep the panel at full-page height when a page has fewer apps -->
        <ul class="mt-6 grid grid-cols-3 grid-rows-[repeat(4,4.5625rem)] gap-x-2 gap-y-4" role="menu">
          <li
            v-for="(app, index) in apps"
            :key="app.id"
            class="flex justify-center"
            role="none"
          >
            <PhoneAppIcon
              :app="app"
              label
              :highlighted="!cursor.dock && index === cursor.index"
              @highlight="cursor = { dock: false, index }"
              @select="select(app)"
            />
          </li>
        </ul>

        <nav
          class="my-4 flex h-2 justify-center gap-2"
          aria-label="Pages"
        >
          <template v-if="pages.length > 1">
            <button
              v-for="(_, index) in pages"
              :key="index"
              type="button"
              :aria-label="`Page ${index + 1}`"
              :aria-current="index === page"
              :class="['size-2 rounded-full', index === page ? 'bg-white' : 'bg-white/30']"
              @click="showPage(index)"
            />
          </template>
        </nav>

        <ul
          class="grid grid-cols-4 justify-items-center rounded-[2rem] bg-white/10 px-2 py-3 backdrop-blur-md"
          role="menu"
          aria-label="Dock"
        >
          <li
            v-for="(app, index) in PHONE_DOCK"
            :key="app.id"
            role="none"
          >
            <PhoneAppIcon
              :app="app"
              :highlighted="cursor.dock && index === cursor.index"
              @highlight="cursor = { dock: true, index }"
              @select="select(app)"
            />
          </li>
        </ul>

        <span class="mx-auto mt-2.5 h-1 w-28 rounded-full bg-white/70" aria-hidden="true" />
      </section>
    </Transition>

    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="shown"
        class="pointer-events-auto absolute right-4 bottom-4 flex gap-2 text-sm"
      >
        <button
          type="button"
          class="flex items-center gap-2 rounded-full bg-default py-1.5 ps-1.5 pe-4 text-default shadow-lg ring-1 ring-white/10"
          @click="close"
        >
          <UKbd value="M" />
          Put Away
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-full bg-default py-1.5 ps-1.5 pe-4 text-default shadow-lg ring-1 ring-white/10"
          @click="select(highlighted)"
        >
          <UKbd value="enter" />
          Select
        </button>
      </div>
    </Transition>
  </div>
</template>
