<script setup lang="ts">
import { usePreferredReducedMotion, useRafFn } from '@vueuse/core'

// Each shape moves every corner and its two handles by the same offset, so the curves stay smooth through the morph.
// Not SMIL <animate>: Chrome does not run it in an <svg> inserted after load, as this v-if does.
const BUBBLE_SHAPES = [
  'M60 40C250 6 700 0 940 30C1000 40 1006 150 986 190C976 205 960 215 975 230C1000 255 990 290 940 296C700 320 300 318 80 300C20 295 10 250 25 215C35 195 30 185 15 170C-10 130 0 55 60 40Z',
  'M55 45C245 11 706 -5 946 25C1006 35 1010 153 990 193C980 208 957 219 972 234C997 259 995 294 945 300C705 324 296 314 76 296C16 291 6 253 21 218C31 198 33 181 18 166C-7 126 -5 60 55 45Z',
  'M64 36C254 2 696 4 936 34C996 44 1003 146 983 186C973 201 964 212 979 227C1004 252 985 287 935 293C695 317 305 323 85 305C25 300 13 246 28 211C38 191 26 188 11 173C-14 133 4 51 64 36Z',
] as const
const BUBBLE_LOOP_SECONDS = 7

const dialog = useDialog()
useDialogInput(dialog)

const morphBubble = createPathMorph(BUBBLE_SHAPES)
const bubblePath = ref<string>(BUBBLE_SHAPES[0])
const motionPreference = usePreferredReducedMotion()
useRafFn(({ timestamp }) => {
  if (!dialog.isOpen.value || motionPreference.value === 'reduce') return
  bubblePath.value = morphBubble(timestamp / 1000 / BUBBLE_LOOP_SECONDS)
})

// Each segment splits into the shown part and a hidden rest, so the words keep their final place while the text appears.
const revealedSegments = computed(() => {
  let left = dialog.revealed.value
  return dialog.segments.value.map((segment) => {
    const shown = Math.max(0, Math.min(left, segment.text.length))
    left -= segment.text.length
    return { ...segment, shown: segment.text.slice(0, shown), hidden: segment.text.slice(shown) }
  })
})

const showChoices = computed(() => dialog.textDone.value && dialog.choices.value.length > 0)
const showContinue = computed(() => dialog.textDone.value && dialog.choices.value.length === 0)

// Not mouseenter: it also fires when the panel appears under a resting cursor, which would steal a pad player's selection.
function hoverChoice(event: PointerEvent, index: number) {
  if (event.movementX || event.movementY) dialog.selected.value = index
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-6"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="opacity-0 translate-y-6"
    >
      <div
        v-if="dialog.isOpen.value"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center px-4 pb-6 sm:pb-10"
      >
        <div class="@container pointer-events-auto relative w-[min(48rem,100%)] select-none text-white">
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
          >
            <ul
              v-if="showChoices"
              class="absolute right-0 bottom-[calc(100%-1.5rem)] z-10 flex min-w-48 flex-col gap-2 rounded-3xl bg-elevated py-5 pr-8 pl-10 sm:-right-6 sm:bottom-[calc(100%-2.5rem)] sm:gap-3 sm:py-6"
            >
              <li
                v-for="(choice, index) in dialog.choices.value"
                :key="choice.text"
              >
                <button
                  type="button"
                  tabindex="-1"
                  class="relative block cursor-pointer whitespace-nowrap text-left text-[clamp(1rem,2.4cqw,1.25rem)] leading-tight"
                  @mousedown.prevent
                  @pointermove="hoverChoice($event, index)"
                  @click="dialog.choose(index)"
                >
                  <span
                    v-if="dialog.selected.value === index"
                    class="absolute -inset-x-1.5 bottom-0 h-1/2 rounded-full bg-selection"
                  />
                  <span class="relative">{{ choice.text }}</span>
                  <PixelHand
                    v-if="dialog.selected.value === index"
                    class="absolute top-1/2 right-full mr-2 origin-right -translate-y-1/2 scale-125 sm:scale-150"
                  />
                </button>
              </li>
            </ul>
          </Transition>

          <div
            class="relative min-h-36 cursor-pointer px-[9%] pt-12 pb-10 sm:min-h-44 sm:pt-14 sm:pb-12"
            @click="dialog.advance()"
          >
            <svg
              class="absolute inset-0 size-full overflow-visible"
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                :d="bubblePath"
                class="fill-[var(--ui-bg)]"
              />
            </svg>

            <span
              v-if="dialog.speaker.value"
              class="speaker-bob absolute -top-6 left-0 -rotate-8 rounded-2xl bg-primary px-6 py-2 text-[clamp(1rem,2.8cqw,1.375rem)]  sm:px-8 sm:py-2.5"
            >
              {{ dialog.speaker.value }}
            </span>

            <p class="relative text-[clamp(1rem,2.6cqw,1.25rem)] leading-[1.75]">
              <span
                v-for="(segment, index) in revealedSegments"
                :key="index"
                :class="segment.highlight && 'text-accent'"
              >{{ segment.shown }}<span class="invisible">{{ segment.hidden }}</span></span>
            </p>

            <svg
              v-if="showContinue"
              class="absolute right-[7%] bottom-6 size-6 animate-bounce fill-continue sm:bottom-8 sm:size-7"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3.5 6.5C2.4 6.5 1.8 7.7 2.4 8.6l8.5 11.2c.5.7 1.6.7 2.1 0l8.5-11.2c.6-.9 0-2.1-1.1-2.1z" />
            </svg>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .speaker-bob {
    animation: speaker-bob 3.2s ease-in-out infinite;
  }
}

@keyframes speaker-bob {
  50% {
    translate: 0 4px;
  }
}
</style>
