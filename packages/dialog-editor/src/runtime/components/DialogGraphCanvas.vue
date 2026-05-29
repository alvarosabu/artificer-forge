<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { GraphEdge, GraphNode } from '../utils/graph'
import type { LayoutMap } from '../../types'
import { useNodeExpansion } from '../composables/useNodeExpansion'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
}>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'layout-change', map: LayoutMap): void
  (e: 'rewire', payload: { source: string, handle: string, target: string }): void
}>()

const { isExpanded } = useNodeExpansion()
const { onNodeDragStop, onConnect, getNodes } = useVueFlow()

const EDGE_CLASS: Record<string, string> = { plain: 'e-plain', success: 'e-ok', failure: 'e-fail', end: 'e-end' }

// While a source node is collapsed its per-choice handles are not rendered, so
// route those edges through the single `bundle` handle instead.
const flowEdges = computed(() => props.edges.map(e => ({
  ...e,
  sourceHandle: isExpanded(e.source) ? e.sourceHandle : 'bundle',
  class: EDGE_CLASS[e.data.kind],
  animated: false,
})))

onNodeDragStop(() => {
  const map: LayoutMap = {}
  for (const n of getNodes.value) map[n.id] = { x: n.position.x, y: n.position.y }
  emit('layout-change', map)
})

onConnect((conn: { source: string, sourceHandle?: string | null, target: string }) => {
  if (!conn.sourceHandle || conn.sourceHandle === 'bundle') return
  emit('rewire', { source: conn.source, handle: conn.sourceHandle, target: conn.target })
})

function onNodeClick(payload: { node: { id: string } }) {
  emit('select', payload.node.id)
}
</script>

<template>
  <VueFlow
    :nodes="nodes"
    :edges="flowEdges"
    :default-viewport="{ zoom: 0.85 }"
    fit-view-on-init
    class="de-canvas"
    @node-click="onNodeClick"
  >
    <template #node-dialog="nodeProps">
      <DeDialogGraphNode v-bind="nodeProps" />
    </template>
    <template #node-dialogEnd>
      <div class="de-end">
        <Handle type="target" :position="Position.Top" />
        ■ __end
      </div>
    </template>
    <Background />
    <Controls />
    <MiniMap />
  </VueFlow>
</template>

<style scoped>
.de-canvas { width:100%; height:100%; background:#151922; }
.de-end { position:relative; background:#2a1f28; border:1px solid #5a3a4a; color:#e0556b; border-radius:7px; padding:8px 12px; font-size:12px; }
:deep(.e-plain .vue-flow__edge-path) { stroke:#7c8499; }
:deep(.e-ok .vue-flow__edge-path) { stroke:#3fbf6f; }
:deep(.e-fail .vue-flow__edge-path) { stroke:#e0556b; }
:deep(.e-end .vue-flow__edge-path) { stroke:#555; }
</style>
