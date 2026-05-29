<script setup lang="ts">
import { watch } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { definePageMeta } from '#imports'
import { useDialogEditor } from '../composables/useDialogEditor'

definePageMeta({ layout: false })

const editor = useDialogEditor()

watch(() => editor.list.value, (list) => {
  if (!editor.activeId.value && list?.dialogs?.length) editor.loadDialog(list.dialogs[0].id)
}, { immediate: true })
</script>

<template>
  <div class="de-shell">
    <DeEditorToolbar
      :dialogs="editor.list.value?.dialogs ?? []"
      :active-id="editor.activeId.value"
      :diagnostics="editor.diagnostics.value"
      @select="editor.loadDialog"
      @expand-all="editor.expandAll"
      @collapse-all="editor.collapseAll"
    />
    <div class="de-body">
      <ClientOnly>
        <DeDialogGraphCanvas
          :nodes="editor.graph.value.nodes"
          :edges="editor.graph.value.edges"
          @select="(id: string) => (editor.selection.value = { nodeId: id, choiceIndex: null })"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<style>
html, body, #__nuxt { margin:0; height:100%; }
.de-shell { display:flex; flex-direction:column; height:100vh; background:#11141c; }
.de-body { flex:1; min-height:0; }
</style>
