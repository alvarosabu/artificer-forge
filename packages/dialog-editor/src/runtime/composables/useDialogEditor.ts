import { computed, ref } from 'vue'
// @ts-expect-error - virtual import resolved by Nuxt at runtime
import { useFetch } from '#imports'
import type { DialogTree, LayoutMap } from '../../types'

// `$fetch` is a Nuxt-injected global (ofetch), not exported from #imports.
declare const $fetch: <T>(url: string, opts?: Record<string, unknown>) => Promise<T>
import { buildGraph } from '../utils/graph'
import { applyDagreLayout } from '../utils/layout'
import { validateTree } from '../utils/validate'

interface DialogListItem { id: string, file: string, startNode: string }
interface DialogList { dialogs: DialogListItem[], flags: string[] }

export function useDialogEditor() {
  const activeId = ref<string | null>(null)
  const tree = ref<DialogTree | null>(null)
  const layout = ref<LayoutMap>({})
  const expanded = ref<Record<string, boolean>>({})
  const selection = ref<{ nodeId: string | null, choiceIndex: number | null }>({ nodeId: null, choiceIndex: null })

  const { data: list, refresh: refreshList } = useFetch<DialogList>('/api/__dialog-editor/dialogs')

  async function loadDialog(id: string) {
    const res = await $fetch<{ tree: DialogTree, layout: LayoutMap }>(`/api/__dialog-editor/dialogs/${id}`)
    activeId.value = id
    tree.value = res.tree
    layout.value = res.layout ?? {}
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

  function toggleExpanded(id: string) { expanded.value[id] = !expanded.value[id] }
  function setExpandedAll(value: boolean) {
    if (!tree.value) return
    for (const id of Object.keys(tree.value.nodes)) expanded.value[id] = value
  }

  return {
    activeId,
    tree,
    layout,
    expanded,
    selection,
    list,
    refreshList,
    loadDialog,
    graph,
    diagnostics,
    toggleExpanded,
    setExpandedAll,
  }
}
