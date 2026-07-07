<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { HEADS, type PartEntry } from '../utils/characterParts'
import { type ThumbDescriptor, type ThumbSlot, thumbKey, useModularThumbnails } from '../composables/useModularThumbnails'

// Collapsible grid of part thumbnails. Each cell bakes (once) via the shared
// ThumbStudio and highlights the current selection. An optional "None" cell maps
// to a null value (bald / clean-shaven / no brows).

const props = withDefaults(defineProps<{
  title: string
  partSlot: ThumbSlot
  parts: PartEntry[]
  modelValue: string | null
  headId: string // base head the non-head thumbnails sit on
  noneLabel?: string | null
  defaultOpen?: boolean
}>(), { noneLabel: null, defaultOpen: false })

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const { thumbUrl, ensureThumb } = useModularThumbnails()

const headPath = computed(() => HEADS.find(h => h.id === props.headId)?.path ?? '')

function descFor(part: PartEntry): ThumbDescriptor {
  if (props.partSlot === 'head') {
    return { key: thumbKey('head', part.id, part.id), slot: 'head', partId: part.id, partPath: part.path, headId: part.id, headPath: part.path }
  }
  return { key: thumbKey(props.partSlot, part.id, props.headId), slot: props.partSlot, partId: part.id, partPath: part.path, headId: props.headId, headPath: headPath.value }
}

// Kick off bakes for every part in this picker (re-runs when the base head changes).
watchEffect(() => {
  props.parts.forEach(p => ensureThumb(descFor(p)))
})

function urlFor(part: PartEntry): string | undefined {
  return thumbUrl(descFor(part).key)
}

const selectedLabel = computed(() => {
  if (props.modelValue === null) return props.noneLabel ?? '—'
  return props.parts.find(p => p.id === props.modelValue)?.label ?? '—'
})
</script>

<template>
  <details class="picker" :open="defaultOpen">
    <summary class="picker-head">
      <span class="picker-title">{{ title }}</span>
      <span class="picker-current">{{ selectedLabel }}</span>
      <svg class="picker-chevron" viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
    </summary>

    <div class="grid">
      <button
        v-if="noneLabel"
        type="button"
        class="cell cell--none"
        :class="{ 'cell--active': modelValue === null }"
        @click="emit('update:modelValue', null)"
      >
        <span class="none-glyph">∅</span>
        <span class="cell-label">{{ noneLabel }}</span>
      </button>

      <button
        v-for="part in parts"
        :key="part.id"
        type="button"
        class="cell"
        :class="{ 'cell--active': modelValue === part.id }"
        :title="part.label"
        @click="emit('update:modelValue', part.id)"
      >
        <img v-if="urlFor(part)" :src="urlFor(part)" :alt="part.label" class="cell-img">
        <span v-else class="cell-loading" />
        <span class="cell-label">{{ part.label }}</span>
      </button>
    </div>
  </details>
</template>

<style scoped>
.picker {
  border: 1px solid rgba(197, 165, 96, 0.18);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}
.picker + .picker { margin-top: 0.6rem; }
.picker-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.picker-head::-webkit-details-marker { display: none; }
.picker-title { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: #c5a560; font-weight: 600; }
.picker-current { margin-left: auto; font-size: 0.72rem; color: #cfcabb; max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-chevron { color: #8b8674; transition: transform 0.18s; flex-shrink: 0; }
.picker[open] .picker-chevron { transform: rotate(180deg); }

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  padding: 0.6rem 0.75rem 0.75rem;
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 0; /* let each cell shrink to its equal 1fr share (default is min-content) */
  padding: 0.3rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  color: #cfcabb;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.cell:hover { border-color: rgba(197, 165, 96, 0.5); }
.cell--active { border-color: #c5a560; background: rgba(197, 165, 96, 0.14); box-shadow: 0 0 0 1px rgba(197, 165, 96, 0.4) inset; }
.cell-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 0.3rem; display: block; }
.cell-loading {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.3rem;
  background: linear-gradient(100deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 70%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.cell--none { justify-content: center; aspect-ratio: 1; }
.none-glyph { font-size: 1.6rem; color: #7d7869; line-height: 1; }
.cell-label { font-size: 0.6rem; line-height: 1.1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
</style>
