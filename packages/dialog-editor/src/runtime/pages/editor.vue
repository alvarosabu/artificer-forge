<script setup lang="ts">
import { onMounted, watch } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { definePageMeta } from '#imports'
import { useDialogEditor } from '../composables/useDialogEditor'
import { useAutocomplete } from '../composables/useAutocomplete'

definePageMeta({ layout: false })

const editor = useDialogEditor()
const auto = useAutocomplete()

onMounted(() => {
  auto.load()
  window.addEventListener('keydown', onKey)
})

watch(() => editor.list.value, (list) => {
  if (!editor.activeId.value && list?.dialogs?.length) editor.loadDialog(list.dialogs[0].id)
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (editor.dirty.value) editor.saveDialog()
  }
}

function onAddNode() {
  const id = window.prompt('New node id:')?.trim()
  if (id && !editor.addNode(id)) window.alert(`Node "${id}" already exists (or invalid).`)
}
function onNewDialog() {
  const id = window.prompt('New dialogId:')?.trim()
  if (!id) return
  const start = window.prompt('Start node id:', 'start')?.trim() || 'start'
  editor.createDialog(id, start)
}
function onRewire(p: { source: string, handle: string, target: string }) {
  editor.setChoiceTargetFromHandle(p.source, p.handle, p.target)
}
</script>

<template>
  <div class="de-shell">
    <DeEditorToolbar
      :dialogs="editor.list.value?.dialogs ?? []"
      :active-id="editor.activeId.value"
      :diagnostics="editor.diagnostics.value"
      :dirty="editor.dirty.value"
      :saving="editor.saving.value"
      @select="editor.loadDialog"
      @expand-all="editor.expandAll"
      @collapse-all="editor.collapseAll"
      @add-node="onAddNode"
      @new-dialog="onNewDialog"
      @save="editor.saveDialog"
    />
    <div class="de-body">
      <div class="de-canvas-wrap">
        <ClientOnly>
          <DeDialogGraphCanvas
            :nodes="editor.graph.value.nodes"
            :edges="editor.graph.value.edges"
            @select="editor.select"
            @layout-change="editor.saveLayout"
            @rewire="onRewire"
          />
        </ClientOnly>
      </div>
      <DeDialogInspector
        :tree="editor.tree.value"
        :node-id="editor.selection.value.nodeId"
        :choice-index="editor.selection.value.choiceIndex"
        :skills="auto.skills"
        :items="auto.items.value"
        :abilities="auto.abilities.value"
        :status-effects="auto.statusEffects.value"
        :classes="auto.classes.value"
        :flags="editor.flags.value"
        @select-choice="(i) => (editor.selection.value.choiceIndex = i)"
        @add-choice="editor.selection.value.nodeId && editor.addChoice(editor.selection.value.nodeId)"
        @delete-choice="(i) => editor.selection.value.nodeId && editor.deleteChoice(editor.selection.value.nodeId, i)"
        @delete-node="editor.selection.value.nodeId && editor.deleteNode(editor.selection.value.nodeId)"
      />
    </div>
  </div>
</template>

<style>
html, body, #__nuxt { margin:0; height:100%; }
.de-shell { display:flex; flex-direction:column; height:100vh; background:#11141c; }
.de-body { flex:1; min-height:0; display:flex; }
.de-canvas-wrap { flex:1; min-width:0; }
</style>
