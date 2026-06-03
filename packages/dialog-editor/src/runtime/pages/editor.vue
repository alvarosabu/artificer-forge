<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { definePageMeta } from '#imports'
import { useDialogEditor } from '../composables/useDialogEditor'
import { useAutocomplete } from '../composables/useAutocomplete'

definePageMeta({ layout: false })

const editor = useDialogEditor()
const auto = useAutocomplete()

const MIN_W = 260
const MAX_W = 720
const sidebarWidth = ref(360)
let dragging = false

onMounted(() => {
  auto.load()
  window.addEventListener('keydown', onKey)
  const saved = Number(window.localStorage.getItem('de-sidebar-w'))
  if (saved >= MIN_W && saved <= MAX_W) sidebarWidth.value = saved
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointermove', onResize)
  window.removeEventListener('pointerup', stopResize)
})

function startResize(e: PointerEvent) {
  dragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onResize)
  window.addEventListener('pointerup', stopResize)
  e.preventDefault()
}
function onResize(e: PointerEvent) {
  if (!dragging) return
  const w = window.innerWidth - e.clientX
  sidebarWidth.value = Math.min(MAX_W, Math.max(MIN_W, w))
}
function stopResize() {
  if (!dragging) return
  dragging = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onResize)
  window.removeEventListener('pointerup', stopResize)
  window.localStorage.setItem('de-sidebar-w', String(sidebarWidth.value))
}

watch(() => editor.list.value, (list) => {
  if (!editor.activeId.value && list?.dialogs?.length) editor.loadDialog(list.dialogs[0].id)
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (editor.dirty.value) editor.saveDialog()
  }
}

function onAddNode(id: string) {
  // Toolbar already validates id (non-empty, unique, charset); addNode is the safety net.
  if (!editor.addNode(id)) console.warn('[de] addNode rejected', id)
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
function onDisconnect(p: { source: string, handle: string }) {
  editor.clearChoiceTargetFromHandle(p.source, p.handle)
}
function onReconnect(p: { oldSource: string, oldHandle: string, newSource: string, newHandle: string, target: string }) {
  editor.reconnectEdge(p)
}
function onCreateNode(p: { nodeId: string, handleId: string | null, handleType: 'source' | 'target', position: { x: number, y: number } }) {
  editor.createConnectedNode({ nodeId: p.nodeId, handleId: p.handleId, handleType: p.handleType }, p.position)
}
function onSplice(p: { source: string, handle: string, target: string, nodeId: string }) {
  editor.spliceNodeOnEdge(p)
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
      :node-ids="Object.keys(editor.tree.value?.nodes ?? {})"
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
            @disconnect="onDisconnect"
            @reconnect="onReconnect"
            @delete-node="editor.deleteNode"
            @create-node="onCreateNode"
            @splice="onSplice"
          />
        </ClientOnly>
      </div>
      <div class="de-resizer" :class="{ dragging }" @pointerdown="startResize" />
      <DeDialogInspector
        class="de-inspector"
        :style="{ width: sidebarWidth + 'px' }"
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
.de-inspector { flex:none; }
.de-resizer { flex:none; width:6px; cursor:col-resize; background:#222838; border-left:1px solid #353b4d; }
.de-resizer:hover, .de-resizer.dragging { background:#6c4bd1; }
</style>
