<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

const dialogStore = useDialogStore()

const visibleChoices = computed(() => dialogStore.currentChoices)

const speakerName = computed(() => dialogStore.currentSpeakerEntity?.name ?? 'Narrator')
const speakerPortrait = computed(() => dialogStore.currentSpeakerEntity?.portrait)

const checkFlash = computed(() => dialogStore.lastCheck)

const isCheckChoice = (raw: { check?: unknown }) => !!raw.check

const checkLabel = (raw: { check?: { skill: string, dc: number } }) => {
  if (!raw.check) return ''
  return `${raw.check.skill.replace(/-/g, ' ').toUpperCase()} ${raw.check.dc}`
}

onKeyStroke(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (e) => {
  if (!dialogStore.isOpen) return
  const idx = Number(e.key) - 1
  const choice = visibleChoices.value[idx]
  if (choice && choice.available) {
    e.preventDefault()
    dialogStore.choose(choice.index)
  }
})

onKeyStroke('Escape', (e) => {
  if (!dialogStore.isOpen) return
  e.preventDefault()
  dialogStore.close()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-x-0 bottom-8 z-60 flex justify-center pointer-events-none">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-6"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-6"
      >
        <div
          v-if="dialogStore.isOpen"
          class="pointer-events-auto w-[min(48rem,calc(100vw-4rem))] flex gap-5 px-6 py-5 max-h-[40vh] font-serif text-gold-100 backdrop-blur-md border border-gold-700/40 rounded-lg shadow-2xl bg-gradient-to-t from-leather-950/95 via-leather-950/90 to-leather-950/80"
        >
        <!-- Portrait -->
        <div class="shrink-0 size-24 border border-gold-700/50 bg-leather-900/60 flex items-center justify-center overflow-hidden">
          <img
            v-if="speakerPortrait"
            :src="speakerPortrait"
            :alt="speakerName"
            class="size-full object-cover"
          >
          <span v-else class="text-4xl font-bold text-gold-500/70">
            {{ speakerName.charAt(0) }}
          </span>
        </div>

        <!-- Body -->
        <div class="flex-1 min-w-0 flex flex-col gap-2">
          <div class="text-sm uppercase tracking-widest font-semibold text-gold-400">
            {{ speakerName }}
          </div>

          <p class="text-lg leading-snug text-gold-50">
            {{ dialogStore.currentText }}
          </p>

          <!-- Skill-check result flash -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
          >
            <div
              v-if="checkFlash"
              :key="`${checkFlash.skill}-${checkFlash.dc}-${checkFlash.roll}`"
              class="inline-flex items-center gap-3 w-fit px-3 py-1.5 text-xs font-semibold tracking-wider rounded-sm border"
              :class="checkFlash.success
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-red-500/15 border-red-400/40 text-red-200'"
            >
              <span>{{ checkFlash.skill.toUpperCase() }} {{ checkFlash.dc }}</span>
              <span class="opacity-85 tabular-nums">
                {{ checkFlash.roll }}{{ checkFlash.modifier >= 0 ? '+' : '' }}{{ checkFlash.modifier }} = {{ checkFlash.total }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon
                  :name="checkFlash.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                  class="size-3.5"
                />
                {{ checkFlash.success ? 'SUCCESS' : 'FAILURE' }}
              </span>
            </div>
          </Transition>

          <!-- Choices -->
          <ul class="flex flex-col gap-1 overflow-y-auto max-h-[18vh]">
            <li
              v-for="(choice, idx) in visibleChoices"
              :key="choice.index"
            >
              <button
                type="button"
                :disabled="!choice.available"
                class="group w-full flex items-baseline gap-2 px-2.5 py-1.5 text-left text-base border border-transparent rounded-sm transition-colors enabled:cursor-pointer enabled:hover:bg-gold-400/10 enabled:hover:border-gold-400/30 focus-visible:bg-gold-400/10 focus-visible:border-gold-400/30 focus-visible:outline-none disabled:cursor-default"
                :class="!choice.available && 'opacity-60'"
                @click="dialogStore.choose(choice.index)"
              >
                <span class="shrink-0 w-6 font-semibold tabular-nums text-gold-400/70">
                  {{ idx + 1 }}.
                </span>
                <span
                  v-if="choice.raw.tagPrefix"
                  class="text-xs font-semibold tracking-wider"
                  :class="choice.available ? 'text-marine-300' : 'text-marine-300/40'"
                >
                  [{{ choice.raw.tagPrefix }}]
                </span>
                <span
                  v-if="isCheckChoice(choice.raw)"
                  class="text-xs font-semibold tracking-wider"
                  :class="choice.available ? 'text-purple-300' : 'text-purple-300/40'"
                >
                  [{{ checkLabel(choice.raw) }}]
                </span>
                <span
                  class="flex-1"
                  :class="choice.available ? 'text-gold-50' : 'text-gold-50/40'"
                >
                  {{ choice.text }}
                </span>
                <span
                  v-if="!choice.available && choice.lockedReason"
                  class="ml-auto text-xs italic text-gold-100/45"
                >
                  {{ choice.lockedReason }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
      </Transition>
    </div>
  </Teleport>
</template>
