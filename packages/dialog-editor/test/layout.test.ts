import { describe, expect, it } from 'vitest'
import type { DialogTree } from '../src/types'
import { buildGraph } from '../src/runtime/utils/graph'
import { applyDagreLayout } from '../src/runtime/utils/layout'

const tree: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
  a: { text: 'hi', choices: [{ text: 'b', next: 'b' }] },
  b: { text: 'bye', choices: [{ text: 'end', next: '__end' }] },
} }

describe('applyDagreLayout', () => {
  it('assigns unique positions to every node', () => {
    const { nodes, edges } = buildGraph(tree)
    const positioned = applyDagreLayout(nodes, edges)
    const keys = positioned.map(n => `${n.position.x},${n.position.y}`)
    expect(new Set(keys).size).toBe(positioned.length)
  })
})
