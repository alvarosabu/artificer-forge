import { computed, nextTick, ref, toRaw, watch } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { useFetch } from '#imports'
import type { DialogTree, LayoutMap, NodePosition } from '../../types'
import { buildGraph } from '../utils/graph'
import { applyDagreLayout } from '../utils/layout'
import { validateTree } from '../utils/validate'
import { clearChoiceTarget, detachReferencesTo, type SpawnPayload, type SplicePayload, spawnConnectedNode, spliceNode, wireChoiceTarget } from '../utils/createNode'
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
    console.debug('[de] graph recompute nodes:', positioned.map(n => n.id))
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
    console.debug('[de] deleteNode', id, 'before:', Object.keys(tree.value.nodes))
    delete tree.value.nodes[id]
    // Clear any choice still pointing at the removed node so no dangling edge
    // survives to silently reconnect to a future node that reuses this id.
    detachReferencesTo(tree.value.nodes, id)
    // Drop the stale saved position so a reused id doesn't snap to it.
    if (layout.value[id]) {
      const { [id]: _, ...rest } = layout.value
      layout.value = rest
    }
    if (selection.value.nodeId === id) selection.value = { nodeId: null, choiceIndex: null }
    console.debug('[de] deleteNode', id, 'after:', Object.keys(tree.value.nodes))
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
    if (n) wireChoiceTarget(n, handle, target)
  }
  // Drag an edge endpoint onto empty canvas: clear the choice's target so the
  // edge disappears while the choice (text/check) is kept for re-wiring.
  function clearChoiceTargetFromHandle(source: string, handle: string) {
    const n = tree.value?.nodes[source]
    if (n) clearChoiceTarget(n, handle)
  }
  // Drag an edge endpoint onto a different handle (either end). Re-point the link
  // by clearing the old choice field and wiring the new one. Aborts without
  // touching the old link if the new handle is invalid (e.g. a collapsed bundle).
  function reconnectEdge(p: { oldSource: string, oldHandle: string, newSource: string, newHandle: string, target: string }) {
    if (!tree.value) return
    if (p.oldSource === p.newSource && p.oldHandle === p.newHandle) {
      // Same handle, only the target moved → straight re-wire.
      const n = tree.value.nodes[p.newSource]
      if (n) wireChoiceTarget(n, p.newHandle, p.target)
      return
    }
    const newNode = tree.value.nodes[p.newSource]
    const oldNode = tree.value.nodes[p.oldSource]
    if (!newNode || !wireChoiceTarget(newNode, p.newHandle, p.target)) return
    if (oldNode) clearChoiceTarget(oldNode, p.oldHandle)
  }
  // Drop-on-edge: drag an existing node C over the A->B edge to splice A->C->B.
  // A's choice re-points to C; C gains a fresh plain choice back out to B.
  function spliceNodeOnEdge(p: SplicePayload) {
    if (!tree.value) return
    if (spliceNode(tree.value, p)) select(p.nodeId)
  }
  // Drag-to-empty-canvas: spawn a node connected to the dragged handle, place it
  // at the drop point, expand + select it. Returns the new node id (or null).
  function createConnectedNode(payload: SpawnPayload, position?: NodePosition): string | null {
    if (!tree.value) return null
    const id = spawnConnectedNode(tree.value, payload)
    if (!id) return null
    if (position) saveLayout({ [id]: position })
    expansion.setAll([id], true)
    select(id)
    return id
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
    clearChoiceTargetFromHandle,
    reconnectEdge,
    spliceNodeOnEdge,
    createConnectedNode,
    createDialog,
    saveLayout,
    saveDialog,
  }
}
