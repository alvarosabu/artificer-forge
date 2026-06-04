<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Diagnostic } from '../../types'

const props = defineProps<{
  dialogs: { id: string, file: string }[]
  activeId: string | null
  diagnostics: Diagnostic[]
  dirty: boolean
  saving: boolean
  nodeIds: string[]
}>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'expand-all'): void
  (e: 'collapse-all'): void
  (e: 'add-node', id: string): void
  (e: 'new-dialog'): void
  (e: 'save'): void
}>()

const adding = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const error = computed(() => {
  const id = draft.value.trim()
  if (!id) return ''
  if (!/^[\w-]+$/.test(id)) return 'Use letters, numbers, _ or -'
  if (props.nodeIds.includes(id)) return `"${id}" already exists`
  return ''
})
const canSubmit = computed(() => !!draft.value.trim() && !error.value)

async function startAdd() {
  adding.value = true
  draft.value = ''
  await nextTick()
  inputEl.value?.focus()
}
function submitAdd() {
  if (!canSubmit.value) return
  emit('add-node', draft.value.trim())
  adding.value = false
  draft.value = ''
}
function cancelAdd() {
  adding.value = false
  draft.value = ''
}
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
    <div class="de-add">
      <button v-if="!adding" class="de-btn" :disabled="!activeId" @click="startAdd">
        + Node
      </button>
      <template v-else>
        <input
          ref="inputEl"
          v-model="draft"
          class="de-input"
          :class="{ invalid: !!error }"
          placeholder="node id"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="submitAdd"
          @keydown.esc.prevent="cancelAdd"
          @blur="cancelAdd"
        >
        <button class="de-btn de-add-ok" :disabled="!canSubmit" @mousedown.prevent="submitAdd">
          Add
        </button>
        <span v-if="error" class="de-err">{{ error }}</span>
      </template>
    </div>
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
.de-add { position:relative; display:flex; align-items:center; gap:6px; }
.de-input { background:#1b1f2a; border:1px solid #3a4055; border-radius:6px; padding:5px 10px; color:#e6e9f0; font-size:12px; width:140px; outline:none; }
.de-input:focus { border-color:#6c4bd1; }
.de-input.invalid { border-color:#e0556a; }
.de-add-ok { background:#6c4bd1; border-color:#6c4bd1; color:#fff; }
.de-add-ok:disabled { background:#1b1f2a; border-color:#3a4055; color:#c3c9d6; }
.de-err { position:absolute; top:calc(100% + 6px); left:0; white-space:nowrap; background:#2a1a20; border:1px solid #e0556a; color:#f0a0ac; border-radius:6px; padding:3px 8px; font-size:11px; z-index:10; }
.de-sp { flex:1; }
.de-diag.warn { color:#e0a23f; }
.de-save { background:#1b1f2a; border:1px solid #3a4055; border-radius:6px; padding:5px 12px; color:#8b93a7; cursor:default; }
.de-save.dirty { background:#6c4bd1; border-color:#6c4bd1; color:#fff; cursor:pointer; }
.de-save:disabled:not(.dirty) { cursor:default; }
</style>
