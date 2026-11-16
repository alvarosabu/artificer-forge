<script lang="ts" setup>
import type { PromptAction, PromptStage } from '~/composables/useProximityPrompt'
import type { InputDevice } from '~/composables/useInputDevice'

const props = defineProps<{
  stage: PromptStage
  action: PromptAction
  presses: number
  /** Picks the glyph: the E key, the Xbox Y button or the PlayStation triangle. */
  device: InputDevice
}>()

const prompt = useTemplateRef<HTMLElement>('prompt')

watch(() => props.presses, () => {
  prompt.value?.animate(
    [{ scale: 1 }, { scale: 0.85 }, { scale: 1.08 }, { scale: 1 }],
    { duration: 280, easing: 'ease-out' },
  )
})
</script>

<template>
  <Transition name="prompt-pop" type="transition">
    <div ref="prompt" v-if="stage !== 'hidden'" class="proximity-prompt" :class="{ 'interact': stage === 'interact' }"
      aria-hidden="true">
      <div class="prompt-body">
        <kbd
          v-if="device === 'keyboard'"
          class="prompt-key"
        >E</kbd>
        <span
          v-else
          class="prompt-button"
          :class="`is-${device}`"
        >
          <svg
            v-if="device === 'playstation'"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 6.5 17.5 16h-11Z"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linejoin="round"
            />
          </svg>
          <template v-else>Y</template>
        </span>
        <span class="prompt-label">{{ action }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.proximity-prompt {
  --morph: 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  /* The pad glyphs copy the real buttons, so they are not theme colors. */
  --pad-face: #111;
  --pad-xbox-y: #f5c518;
  --pad-ps-triangle: #3ed6c6;
  display: grid;
  grid-template-columns: 0fr;
  width: max-content;
  min-width: 14px;
  height: 14px;
  padding: 0;
  rotate: 45deg;
  border-radius: 3px;
  background: var(--ui-text);
  box-shadow: 0 0 0 2px var(--ui-bg), 0 4px 10px rgb(0 0 0 / 0.35);
  animation: prompt-bob 1.6s ease-in-out infinite;
  transition:
    grid-template-columns var(--morph),
    height var(--morph),
    padding var(--morph),
    rotate var(--morph),
    border-radius var(--morph),
    background-color 200ms ease-out;
}

.prompt-body {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 120ms ease-in;
}

.proximity-prompt.interact {
  grid-template-columns: 1fr;
  height: 32px;
  padding: 0 14px 0 4px;
  rotate: 0deg;
  border-radius: 16px;
  background: var(--ui-bg);
}

.interact .prompt-body {
  opacity: 1;
  transition: opacity 180ms ease-out 140ms;
}

.prompt-key {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--ui-text);
  color: var(--ui-bg);
  font: 900 14px/1 var(--font-sans);
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
}

.prompt-label {
  color: var(--ui-text);
  font: 700 14px/1 var(--font-sans);
}

.prompt-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--pad-face);
  font: 900 14px/1 var(--font-sans);
  box-shadow: inset 0 -2px 0 rgb(255 255 255 / 0.15), 0 0 0 1.5px rgb(255 255 255 / 0.3);
}

.prompt-button.is-xbox {
  color: var(--pad-xbox-y);
}

.prompt-button.is-playstation {
  color: var(--pad-ps-triangle);
}

.prompt-button svg {
  width: 18px;
  height: 18px;
}

@keyframes prompt-bob {
  50% {
    translate: 0 -5px;
  }
}

.prompt-pop-enter-active {
  transition: scale 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease-out;
}

.prompt-pop-leave-active {
  transition: scale 200ms ease-in, opacity 200ms ease-in;
}

.prompt-pop-enter-from,
.prompt-pop-leave-to {
  scale: 0;
  opacity: 0;
}
</style>