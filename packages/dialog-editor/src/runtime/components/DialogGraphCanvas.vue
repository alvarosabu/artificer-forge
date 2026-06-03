<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  (e: 'disconnect', payload: { source: string, handle: string }): void
  (e: 'reconnect', payload: { oldSource: string, oldHandle: string, newSource: string, newHandle: string, target: string }): void
  (e: 'delete-node', id: string): void
  (e: 'create-node', payload: { nodeId: string, handleId: string | null, handleType: 'source' | 'target', position: { x: number, y: number } }): void
  (e: 'splice', payload: { source: string, handle: string, target: string, nodeId: string }): void
}>()

const END = '__end'

const { isExpanded } = useNodeExpansion()

watch(() => props.nodes, n => console.debug('[de] canvas <- nodes prop:', n.map(x => x.id)), { immediate: true })
const { onNodeDrag, onNodeDragStop, onNodesChange, onConnect, onConnectStart, onConnectEnd, onEdgeUpdate, onEdgeUpdateStart, onEdgeUpdateEnd, getNodes, screenToFlowCoordinate } = useVueFlow()

// VueFlow's keyboard delete (Delete/Backspace) removes nodes from its internal
// store only. Route those removals through our tree (the source of truth) so the
// node doesn't get re-added on the next graph recompute. __end is synthetic.
onNodesChange((changes) => {
  for (const c of changes) {
    if (c.type === 'remove') {
      console.debug('[de] nodesChange remove', c.id)
      if (c.id !== END) emit('delete-node', c.id)
    }
  }
})

const CHOICE_HANDLE = /^c\d+(-ok|-fail)?$/

// The handle on a collapsed source node is rendered as `bundle`, so an edge's
// live `sourceHandle` may not be the real choice handle. The edge id encodes the
// real one (`${source}:${handle}->${target}`); recover it from our own props.
function realHandle(edgeId: string): { source: string, handle: string } | null {
  const e = props.edges.find(x => x.id === edgeId)
  return e ? { source: e.source, handle: e.sourceHandle } : null
}

const EDGE_CLASS: Record<string, string> = { plain: 'e-plain', success: 'e-ok', failure: 'e-fail', end: 'e-end' }

// While a source node is collapsed its per-choice handles are not rendered, so
// route those edges through the single `bundle` handle instead.
// Edge currently highlighted as a splice target (the dragged node hovers over it).
const spliceTarget = ref<string | null>(null)

const flowEdges = computed(() => props.edges.map(e => ({
  ...e,
  sourceHandle: isExpanded(e.source) ? e.sourceHandle : 'bundle',
  class: [EDGE_CLASS[e.data.kind], e.id === spliceTarget.value ? 'e-splice-target' : ''].filter(Boolean).join(' '),
  animated: false,
})))

// Drop-on-edge splicing: while dragging a node, find the nearest edge its center
// hovers over (approximating the edge as the segment between its endpoint node
// centers). On drop, that edge gets spliced into A->C->B. Threshold is in flow
// coordinates. Edges touching the dragged node are skipped — can't splice itself.
const SPLICE_THRESHOLD = 48

function center(n: { position: { x: number, y: number }, dimensions?: { width: number, height: number } }) {
  return { x: n.position.x + (n.dimensions?.width ?? 0) / 2, y: n.position.y + (n.dimensions?.height ?? 0) / 2 }
}

function distToSegment(p: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

onNodeDrag(({ node }) => {
  const byId = new Map(getNodes.value.map(n => [n.id, n]))
  const c = center(node)
  let best: string | null = null
  let bestD = Infinity
  for (const e of props.edges) {
    if (e.source === node.id || e.target === node.id) continue
    const s = byId.get(e.source), t = byId.get(e.target)
    if (!s || !t) continue
    const d = distToSegment(c, center(s), center(t))
    if (d < bestD) { bestD = d; best = e.id }
  }
  spliceTarget.value = bestD <= SPLICE_THRESHOLD ? best : null
})

onNodeDragStop(({ node }) => {
  const hit = spliceTarget.value ? props.edges.find(x => x.id === spliceTarget.value) : null
  spliceTarget.value = null
  if (hit) emit('splice', { source: hit.source, handle: hit.sourceHandle, target: hit.target, nodeId: node.id })
  const map: LayoutMap = {}
  for (const n of getNodes.value) map[n.id] = { x: n.position.x, y: n.position.y }
  emit('layout-change', map)
})

// Capture the handle a connection drag starts from; if it ends on the empty
// pane (no onConnect to a real handle) we spawn a new node instead of rewiring.
let dragStart: { nodeId: string, handleId: string | null, handleType: 'source' | 'target' } | null = null
let connected = false
// VueFlow implements edge reconnection by starting a connection from the anchored
// end, so an edge-update drag ALSO fires connectStart/connectEnd. This flag (set in
// edgeUpdateStart, which fires first) lets connectEnd skip the spawn during a
// reconnection — otherwise detaching to empty canvas would also create a node.
let updating = false

onConnectStart(({ nodeId, handleId, handleType }) => {
  dragStart = nodeId ? { nodeId, handleId, handleType: handleType ?? 'source' } : null
  connected = false
  console.debug('[de] connectStart', { nodeId, handleId, handleType })
})

onConnect((conn: { source: string, sourceHandle?: string | null, target: string }) => {
  connected = true
  console.debug('[de] connect', conn)
  if (!conn.sourceHandle || conn.sourceHandle === 'bundle') return
  emit('rewire', { source: conn.source, handle: conn.sourceHandle, target: conn.target })
})

onConnectEnd((event?: MouseEvent | TouchEvent) => {
  const start = dragStart
  dragStart = null
  const target = event?.target as HTMLElement | null
  console.debug('[de] connectEnd', { start, connected, updating, targetClass: target?.className })
  // Skip during an edge reconnection — onEdgeUpdateEnd handles detach/reconnect.
  if (updating) return
  if (!start || connected || !event) return
  // Only spawn when released on the empty canvas, not a node/handle/control.
  if (!target?.classList.contains('vue-flow__pane')) return
  const point = 'clientX' in event ? event : event.changedTouches[0]
  if (!point) return
  const position = screenToFlowCoordinate({ x: point.clientX, y: point.clientY })
  console.debug('[de] SPAWN', start)
  emit('create-node', { ...start, position })
})

// Blender-style edge reconnection: grab an endpoint anchor and drag it. Drop on
// a handle → reconnect (`onEdgeUpdate`); drop on empty canvas → detach (the
// update never fires, so `onEdgeUpdateEnd` sees `updated === false`).
let updated = false

onEdgeUpdateStart(() => { updated = false; updating = true })

onEdgeUpdate(({ edge, connection }) => {
  updated = true
  const orig = realHandle(edge.id)
  if (!orig) return
  // New side: trust the connection's source handle only when it's a real choice
  // handle (an expanded node); otherwise the source end didn't move — keep the old.
  const ch = connection.sourceHandle
  const newHandle = ch && CHOICE_HANDLE.test(ch) ? ch : orig.handle
  console.debug('[de] edgeUpdate', { orig, connection })
  emit('reconnect', {
    oldSource: orig.source,
    oldHandle: orig.handle,
    newSource: connection.source,
    newHandle,
    target: connection.target,
  })
})

onEdgeUpdateEnd(({ edge }) => {
  updating = false
  if (updated) return
  const orig = realHandle(edge.id)
  console.debug('[de] edgeDetach', orig)
  if (orig) emit('disconnect', { source: orig.source, handle: orig.handle })
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
    :edges-updatable="true"
    :edge-updater-radius="2"
    :delete-key-code="['Delete', 'Backspace']"
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
/* Highlight an edge on hover so its draggable endpoint anchors are discoverable. */
:deep(.vue-flow__edge:hover .vue-flow__edge-path) { stroke-width:3; filter:drop-shadow(0 0 3px currentColor); }
:deep(.vue-flow__edge.selected .vue-flow__edge-path) { stroke-width:3; }
/* A node is being dragged over this edge: splice candidate. */
:deep(.e-splice-target .vue-flow__edge-path) { stroke:#f0b429 !important; stroke-width:4; stroke-dasharray:8 4; filter:drop-shadow(0 0 6px #f0b429); }
/* The endpoint grab handles: invisible until the edge is hovered. The anchor is
   offset from the endpoint by edge-updater-radius (8); matching r keeps its inner
   edge against the handle so it reads as attached, not floating. */
:deep(.vue-flow__edgeupdater) { cursor:grab; opacity:0; r:4; }
:deep(.vue-flow__edge:hover .vue-flow__edgeupdater) { opacity:.85; fill:#fff; }
</style>
