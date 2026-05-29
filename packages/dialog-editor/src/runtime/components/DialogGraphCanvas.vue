<script setup lang="ts">
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { GraphEdge, GraphNode } from '../utils/graph'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  expanded: Record<string, boolean>
}>()
const emit = defineEmits<{ (e: 'toggle', id: string): void, (e: 'select', id: string): void }>()

const EDGE_CLASS: Record<string, string> = { plain: 'e-plain', success: 'e-ok', failure: 'e-fail', end: 'e-end' }

const flowNodes = computed(() => props.nodes.map(n => ({
  ...n,
  data: { ...n.data, expanded: props.expanded[n.id] ?? false },
})))
const flowEdges = computed(() => props.edges.map(e => ({ ...e, class: EDGE_CLASS[e.data.kind], animated: false })))

function onNodeClick(payload: { node: { id: string } }) {
  emit('select', payload.node.id)
}
</script>

<template>
  <VueFlow
    :nodes="flowNodes"
    :edges="flowEdges"
    :default-viewport="{ zoom: 0.85 }"
    fit-view-on-init
    class="de-canvas"
    @node-click="onNodeClick"
  >
    <template #node-dialog="nodeProps">
      <DeDialogGraphNode v-bind="nodeProps" @toggle="(id: string) => emit('toggle', id)" />
    </template>
    <template #node-dialogEnd>
      <div class="de-end">
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
.de-end { background:#2a1f28; border:1px solid #5a3a4a; color:#e0556b; border-radius:7px; padding:8px 12px; font-size:12px; }
:deep(.e-plain .vue-flow__edge-path) { stroke:#7c8499; }
:deep(.e-ok .vue-flow__edge-path) { stroke:#3fbf6f; }
:deep(.e-fail .vue-flow__edge-path) { stroke:#e0556b; }
:deep(.e-end .vue-flow__edge-path) { stroke:#555; }
</style>
