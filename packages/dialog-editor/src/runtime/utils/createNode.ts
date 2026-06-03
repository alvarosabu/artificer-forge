import type { DialogNode, DialogTree } from '../../types'

// First free `node_N` id for a freshly spawned node.
export function nextNodeId(nodes: Record<string, DialogNode>): string {
  let i = 1
  while (nodes[`node_${i}`]) i++
  return `node_${i}`
}

// Point the choice field a Vue Flow source handle drives at `target`.
// Returns false if the handle id isn't a recognized choice handle.
export function wireChoiceTarget(node: DialogNode, handle: string, target: string): boolean {
  if (!node.choices) return false
  let m: RegExpMatchArray | null
  if ((m = handle.match(/^c(\d+)$/))) { node.choices[+m[1]].next = target; return true }
  if ((m = handle.match(/^c(\d+)-ok$/))) { (node.choices[+m[1]].onSuccess ??= {}).next = target; return true }
  if ((m = handle.match(/^c(\d+)-fail$/))) { (node.choices[+m[1]].onFailure ??= {}).next = target; return true }
  return false
}

// Clear the target a Vue Flow source handle drives, leaving the choice itself
// intact (text, conditions, check). Mirror of `wireChoiceTarget`.
// Returns false if the handle isn't recognized or the branch doesn't exist.
export function clearChoiceTarget(node: DialogNode, handle: string): boolean {
  if (!node.choices) return false
  let m: RegExpMatchArray | null
  if ((m = handle.match(/^c(\d+)$/))) { node.choices[+m[1]].next = undefined; return true }
  if ((m = handle.match(/^c(\d+)-ok$/))) {
    const b = node.choices[+m[1]].onSuccess
    if (!b) return false
    b.next = undefined
    return true
  }
  if ((m = handle.match(/^c(\d+)-fail$/))) {
    const b = node.choices[+m[1]].onFailure
    if (!b) return false
    b.next = undefined
    return true
  }
  return false
}

// Clear every choice target across all nodes that points at `id` (plain `next`,
// `onSuccess.next`, `onFailure.next`). Used when deleting a node so no choice is
// left dangling at a ghost. The choices themselves are kept. Returns how many
// targets were cleared.
export function detachReferencesTo(nodes: Record<string, DialogNode>, id: string): number {
  let cleared = 0
  for (const node of Object.values(nodes)) {
    for (const choice of node.choices ?? []) {
      if (choice.next === id) { choice.next = undefined; cleared++ }
      if (choice.onSuccess?.next === id) { choice.onSuccess.next = undefined; cleared++ }
      if (choice.onFailure?.next === id) { choice.onFailure.next = undefined; cleared++ }
    }
  }
  return cleared
}

export interface SpawnPayload {
  nodeId: string
  handleId: string | null | undefined
  handleType: 'source' | 'target'
}

// Create a new node connected to an existing one via a dragged handle.
// - source handle → new downstream node, wired from the dragged choice.
// - target handle → new upstream node with a choice pointing back into `nodeId`.
// Returns the new node id, or null if the gesture maps to nothing actionable.
export function spawnConnectedNode(tree: DialogTree, payload: SpawnPayload): string | null {
  const { nodeId, handleId, handleType } = payload

  if (handleType === 'target') {
    const newId = nextNodeId(tree.nodes)
    tree.nodes[newId] = { text: '', choices: [{ text: 'New choice', next: nodeId }] }
    return newId
  }

  if (!handleId || handleId === 'bundle') return null
  const src = tree.nodes[nodeId]
  if (!src) return null
  const newId = nextNodeId(tree.nodes)
  if (!wireChoiceTarget(src, handleId, newId)) return null
  tree.nodes[newId] = { text: '', choices: [] }
  return newId
}

export interface SplicePayload {
  source: string
  handle: string
  target: string
  nodeId: string
}

// Insert an existing node `nodeId` (C) into the edge A->B (source->target via
// `handle`), yielding A->C->B. A's choice that drove the edge is re-pointed at C
// (preserving plain/onSuccess/onFailure), and C gets a fresh plain choice to B.
// Rejects (without mutating) if C is the edge's own endpoint, C doesn't exist,
// or the handle isn't a recognized choice handle. Returns whether it spliced.
export function spliceNode(tree: DialogTree, payload: SplicePayload): boolean {
  const { source, handle, target, nodeId } = payload
  if (nodeId === source || nodeId === target) return false
  const src = tree.nodes[source]
  const mid = tree.nodes[nodeId]
  if (!src || !mid) return false
  if (!wireChoiceTarget(src, handle, nodeId)) return false
  ;(mid.choices ??= []).push({ text: 'New choice', next: target })
  return true
}
