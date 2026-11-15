<script lang="ts" setup>
import type { PromptStage } from '~/composables/useProximityPrompt'

defineProps<{
  stage: PromptStage
  action: string
}>()
</script>

<template>
  <Transition name="prompt-pop" type="transition">
    <div v-if="stage !== 'hidden'" class="proximity-prompt" :class="{ 'interact': stage === 'interact' }"
      aria-hidden="true">
      <div class="prompt-body">
        <kbd class="prompt-key">E</kbd>
        <span class="prompt-label">{{ action }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.proximity-prompt {
  --morph: 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  display: grid;
  grid-template-columns: 0fr;
  width: max-content;
  min-width: 14px;
  height: 14px;
  padding: 0;
  rotate: 45deg;
  border-radius: 3px;
  background: #fff;
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
  background: #fff;
  color: var(--ui-bg);
  font: 900 14px/1 var(--font-sans);
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
}

.prompt-label {
  color: #fff;
  font: 700 14px/1 var(--font-sans);
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