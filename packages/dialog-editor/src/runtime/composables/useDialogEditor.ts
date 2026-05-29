import { computed, ref } from 'vue'
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

  const { data: list, refresh: refreshList } = useFetch<DialogList>('/api/__dialog-editor/dialogs')

  async function loadDialog(id: string) {
    const res = await $fetch<{ tree: DialogTree, layout: LayoutMap }>(`/api/__dialog-editor/dialogs/${id}`)
    activeId.value = id
    tree.value = res.tree
    layout.value = res.layout ?? {}
    expansion.reset()
  }

  const graph = computed(() => {
    if (!tree.value) return { nodes: [], edges: [] }
    const built = buildGraph(tree.value)
    const positioned = applyDagreLayout(built.nodes, built.edges).map(n =>
      layout.value[n.id] ? { ...n, position: layout.value[n.id] } : n,
    )
    return { nodes: positioned, edges: built.edges }
  })

  const diagnostics = computed(() => (tree.value ? validateTree(tree.value) : []))

  function expandAll() {
    if (tree.value) expansion.setAll(Object.keys(tree.value.nodes), true)
  }
  function collapseAll() {
    if (tree.value) expansion.setAll(Object.keys(tree.value.nodes), false)
  }

  return {
    activeId,
    tree,
    layout,
    selection,
    list,
    refreshList,
    loadDialog,
    graph,
    diagnostics,
    expandAll,
    collapseAll,
  }
}
