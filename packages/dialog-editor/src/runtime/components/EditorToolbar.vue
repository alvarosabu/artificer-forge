<script setup lang="ts">
import type { Diagnostic } from '../../types'

defineProps<{
  dialogs: { id: string, file: string }[]
  activeId: string | null
  diagnostics: Diagnostic[]
  dirty: boolean
  saving: boolean
}>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'expand-all'): void
  (e: 'collapse-all'): void
  (e: 'add-node'): void
  (e: 'new-dialog'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div class="de-bar">
    <select :value="activeId ?? ''" class="de-pick" @change="emit('select', ($event.target as HTMLSelectElement).value)">
      <option value="" disabled>
        Pick a dialog…
      </option>
      <option v-for="d in dialogs" :key="d.id" :value="d.id">
        {{ d.id }}
      </option>
    </select>
    <button class="de-btn" @click="emit('new-dialog')">
      + New dialog
    </button>
    <button class="de-btn" :disabled="!activeId" @click="emit('add-node')">
      + Node
    </button>
    <button class="de-btn" @click="emit('expand-all')">
      ⤢ Expand all
    </button>
    <button class="de-btn" @click="emit('collapse-all')">
      ⤡ Collapse all
    </button>
    <span class="de-sp" />
    <span class="de-diag" :class="{ warn: diagnostics.length }">
      {{ diagnostics.length ? `⚠ ${diagnostics.length} issue${diagnostics.length > 1 ? 's' : ''}` : '✓ no issues' }}
    </span>
    <button class="de-save" :class="{ dirty }" :disabled="!dirty || saving" @click="emit('save')">
      {{ saving ? 'Saving…' : dirty ? '● Save' : 'Saved' }}
    </button>
  </div>
</template>

<style scoped>
.de-bar { display:flex; align-items:center; gap:8px; padding:9px 12px; background:#222838; border-bottom:1px solid #353b4d; color:#e6e9f0; font-size:12px; }
.de-pick, .de-btn { background:#1b1f2a; border:1px solid #3a4055; border-radius:6px; padding:5px 10px; color:#c3c9d6; cursor:pointer; }
.de-btn:disabled { opacity:.4; cursor:not-allowed; }
.de-sp { flex:1; }
.de-diag.warn { color:#e0a23f; }
.de-save { background:#1b1f2a; border:1px solid #3a4055; border-radius:6px; padding:5px 12px; color:#8b93a7; cursor:default; }
.de-save.dirty { background:#6c4bd1; border-color:#6c4bd1; color:#fff; cursor:pointer; }
.de-save:disabled:not(.dirty) { cursor:default; }
</style>
