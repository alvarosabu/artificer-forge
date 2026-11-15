<script lang="ts" setup>
import type { PromptStage } from '~/composables/useProximityPrompt'

defineProps<{
  stage: PromptStage
}>()
</script>

<template>
  <Transition
    name="prompt-pop"
    type="transition"
  >
    <div
      v-if="stage !== 'hidden'"
      class="proximity-prompt"
      :class="{ 'interact': stage === 'interact' }"
      aria-hidden="true"
    />
  </Transition>
</template>

<style scoped>
.proximity-prompt {
  width: 14px;
  height: 14px;
  rotate: 45deg;
  border-radius: 3px;
  background: #fff;
  box-shadow: 0 0 0 2px var(--ui-bg), 0 4px 10px rgb(0 0 0 / 0.35);
  animation: prompt-bob 1.6s ease-in-out infinite;
}

.proximity-prompt.interact {
  background: var(--color-accent);
}

@keyframes prompt-bob {
  50% { translate: 0 -5px; }
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