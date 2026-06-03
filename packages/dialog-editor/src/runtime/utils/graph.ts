import type { DialogChoice, DialogNode } from '../../types'

const END = '__end'

export type EdgeKind = 'plain' | 'success' | 'failure' | 'end'

export interface GraphNode {
  id: string
  type: 'dialog' | 'dialogEnd'
  position: { x: number, y: number }
  data: { nodeId: string, node: DialogNode }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle: string
  data: { kind: EdgeKind, label: string }
}

function kindFor(target: string, base: 'plain' | 'success' | 'failure'): EdgeKind {
  return target === END ? 'end' : base
}

export function buildGraph(tree: { nodes: Record<string, DialogNode> }): { nodes: GraphNode[], edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  function addEdge(source: string, target: string, handle: string, base: 'plain' | 'success' | 'failure', label: string) {
    edges.push({ id: `${source}:${handle}->${target}`, source, target, sourceHandle: handle, data: { kind: kindFor(target, base), label } })
  }

  for (const [id, node] of Object.entries(tree.nodes)) {
    nodes.push({ id, type: 'dialog', position: { x: 0, y: 0 }, data: { nodeId: id, node } })
    const choices = node.choices ?? []
    choices.forEach((choice: DialogChoice, i: number) => {
      if (choice.check) {
        if (choice.onSuccess?.next) addEdge(id, choice.onSuccess.next, `c${i}-ok`, 'success', choice.text)
        if (choice.onFailure?.next) addEdge(id, choice.onFailure.next, `c${i}-fail`, 'failure', choice.text)
      }
      else if (choice.next) {
        addEdge(id, choice.next, `c${i}`, 'plain', choice.text)
      }
    })
  }

  // Always render __end as a fixed terminal so it stays available as a reconnect
  // target even when no choice currently points at it.
  nodes.push({ id: END, type: 'dialogEnd', position: { x: 0, y: 0 }, data: { nodeId: END, node: { text: '' } } })

  return { nodes, edges }
}
