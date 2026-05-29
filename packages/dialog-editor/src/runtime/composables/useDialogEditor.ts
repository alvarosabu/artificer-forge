import { computed, nextTick, ref, toRaw, watch } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { useFetch } from '#imports'
import type { DialogTree, LayoutMap } from '../../types'
import { buildGraph } from '../utils/graph'
import { applyDagreLayout } from '../utils/layout'
import { validateTree } from '../utils/validate'
import { useNodeExpansion } from './useNodeExpansion'

// `$fetch` is a Nuxt-injected global (ofetch), not exported from #imports.
declare const $fetch: <T>(url: string, opts?: Record<string, unknown>) => Promise<T>

interface DialogListItem { id: string, file: string, startNode: string }
interface DialogList { dialogs: DialogListItem[], flags: string[] }

export function useDialogEditor() {
  const expansion = useNodeExpansion()
  const activeId = ref<string | null>(null)
  const tree = ref<DialogTree | null>(null)
  const layout = ref<LayoutMap>({})
  const selection = ref<{ nodeId: string | null, choiceIndex: number | null }>({ nodeId: null, choiceIndex: null })
  const dirty = ref(false)
  const saving = ref(false)

  let hydrating = false

  const { data: list, refresh: refreshList } = useFetch<DialogList>('/api/__dialog-editor/dialogs')

  const flags = computed(() => list.value?.flags ?? [])

  async function loadDialog(id: string) {
    const res = await $fetch<{ tree: DialogTree, layout: LayoutMap }>(`/api/__dialog-editor/dialogs/${id}`)
    hydrating = true
    activeId.value = id
    tree.value = res.tree
    layout.value = res.layout ?? {}
    selection.value = { nodeId: null, choiceIndex: null }
    dirty.value = false
    expansion.reset()
    await nextTick()
    hydrating = false
  }

  // Any deep mutation of the working tree marks it dirty (except during hydration).
  watch(tree, () => { if (!hydrating) dirty.value = true }, { deep: true })

  const graph = computed(() => {
    if (!tree.value) return { nodes: [], edges: [] }
    const built = buildGraph(tree.value)
    const positioned = applyDagreLayout(built.nodes, built.edges).map(n =>
      layout.value[n.id] ? { ...n, position: layout.value[n.id] } : n,
    )
    return { nodes: positioned, edges: built.edges }
  })

  const diagnostics = computed(() => (tree.value ? validateTree(tree.value) : []))

  const selectedNode = computed(() => {
    const id = selection.value.nodeId
    return id && tree.value ? tree.value.nodes[id] ?? null : null
  })

  function select(nodeId: string) {
    selection.value = { nodeId, choiceIndex: null }
  }

  function expandAll() {
    if (tree.value) expansion.setAll(Object.keys(tree.value.nodes), true)
  }
  function collapseAll() {
    if (tree.value) expansion.setAll(Object.keys(tree.value.nodes), false)
  }

  // --- Structural editing ---
  function addNode(id: string): boolean {
    if (!tree.value || !id || tree.value.nodes[id]) return false
    tree.value.nodes[id] = { text: '', choices: [] }
    expansion.setAll([id], true)
    select(id)
    return true
  }
  function deleteNode(id: string) {
    if (!tree.value) return
    delete tree.value.nodes[id]
    if (selection.value.nodeId === id) selection.value = { nodeId: null, choiceIndex: null }
  }
  function addChoice(nodeId: string) {
    const n = tree.value?.nodes[nodeId]
    if (!n) return
    ;(n.choices ??= []).push({ text: 'New choice', next: '__end' })
    expansion.setAll([nodeId], true)
  }
  function deleteChoice(nodeId: string, i: number) {
    tree.value?.nodes[nodeId]?.choices?.splice(i, 1)
    if (selection.value.nodeId === nodeId && selection.value.choiceIndex === i) selection.value.choiceIndex = null
  }
  // Drag-to-rewire: map a Vue Flow source handle id to the choice field it drives.
  function setChoiceTargetFromHandle(source: string, handle: string, target: string) {
    const n = tree.value?.nodes[source]
    if (!n?.choices) return
    let m: RegExpMatchArray | null
    if ((m = handle.match(/^c(\d+)$/))) { n.choices[+m[1]].next = target }
    else if ((m = handle.match(/^c(\d+)-ok$/))) { (n.choices[+m[1]].onSuccess ??= {}).next = target }
    else if ((m = handle.match(/^c(\d+)-fail$/))) { (n.choices[+m[1]].onFailure ??= {}).next = target }
  }

  async function createDialog(id: string, startNode = 'start') {
    await $fetch(`/api/__dialog-editor/dialogs/${id}`, {
      method: 'PUT',
      body: { tree: { dialogId: id, startNode, nodes: { [startNode]: { text: '', choices: [] } } } },
    })
    await refreshList()
    await loadDialog(id)
  }

  // --- Persistence ---
  let layoutTimer: ReturnType<typeof setTimeout> | null = null
  function saveLayout(map: LayoutMap) {
    layout.value = { ...layout.value, ...map }
    const id = activeId.value
    if (!id) return
    const payload = { ...layout.value }
    if (layoutTimer) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => {
      $fetch(`/api/__dialog-editor/dialogs/${id}/layout`, { method: 'PUT', body: payload }).catch(() => {})
    }, 500)
  }

  async function saveDialog() {
    if (!tree.value || !activeId.value) return
    saving.value = true
    try {
      await $fetch(`/api/__dialog-editor/dialogs/${activeId.value}`, {
        method: 'PUT',
        body: { tree: toRaw(tree.value) },
      })
      dirty.value = false
      await refreshList()
    }
    finally {
      saving.value = false
    }
  }

  return {
    activeId,
    tree,
    layout,
    selection,
    selectedNode,
    dirty,
    saving,
    list,
    flags,
    refreshList,
    loadDialog,
    graph,
    diagnostics,
    select,
    expandAll,
    collapseAll,
    addNode,
    deleteNode,
    addChoice,
    deleteChoice,
    setChoiceTargetFromHandle,
    createDialog,
    saveLayout,
    saveDialog,
  }
}
