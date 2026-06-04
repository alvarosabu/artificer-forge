import { describe, expect, it } from 'vitest'
import type { DialogTree } from '../src/types'
import { buildGraph } from '../src/runtime/utils/graph'

const tree: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
  a: { text: 'hi', speaker: 'zynrae', choices: [
    { text: 'go b', next: 'b' },
    { text: 'check', check: { skill: 'insight', dc: 12 }, onSuccess: { next: 'b' }, onFailure: { next: '__end' } },
  ] },
  b: { text: 'bye', choices: [{ text: 'end', next: '__end' }] },
} }

describe('buildGraph', () => {
  it('creates one Vue Flow node per dialog node plus a synthetic __end node', () => {
    const { nodes } = buildGraph(tree)
    const ids = nodes.map(n => n.id).sort()
    expect(ids).toEqual(['__end', 'a', 'b'])
    expect(nodes.find(n => n.id === '__end')!.type).toBe('dialogEnd')
    expect(nodes.find(n => n.id === 'a')!.type).toBe('dialog')
  })

  it('always renders __end even when no choice targets it', () => {
    const { nodes } = buildGraph({ nodes: { a: { text: 'hi', choices: [{ text: 'noop' }] } } })
    expect(nodes.find(n => n.id === '__end')?.type).toBe('dialogEnd')
  })

  it('passes node + choice data through node.data', () => {
    const { nodes } = buildGraph(tree)
    const a = nodes.find(n => n.id === 'a')!
    expect(a.data.nodeId).toBe('a')
    expect(a.data.node.speaker).toBe('zynrae')
    expect(a.data.node.choices).toHaveLength(2)
  })

  it('emits edges with correct kind + sourceHandle per choice', () => {
    const { edges } = buildGraph(tree)
    expect(edges.some(e => e.source === 'a' && e.target === 'b' && e.data.kind === 'plain' && e.sourceHandle === 'c0')).toBe(true)
    expect(edges.some(e => e.source === 'a' && e.target === 'b' && e.data.kind === 'success' && e.sourceHandle === 'c1-ok')).toBe(true)
    expect(edges.some(e => e.source === 'a' && e.target === '__end' && e.data.kind === 'end' && e.sourceHandle === 'c1-fail')).toBe(true)
  })

  it('gives every node a position (0,0 pre-layout)', () => {
    const { nodes } = buildGraph(tree)
    expect(nodes.every(n => n.position && typeof n.position.x === 'number')).toBe(true)
  })
})
