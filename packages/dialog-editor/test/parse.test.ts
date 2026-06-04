import { describe, expect, it } from 'vitest'
import { parseDialog } from '../src/runtime/utils/parse'

describe('parseDialog', () => {
  it('normalizes a minimal raw object into a DialogTree', () => {
    const raw = { dialogId: 'd', startNode: 'a', nodes: { a: { text: 'hi' } } }
    const tree = parseDialog(raw)
    expect(tree.dialogId).toBe('d')
    expect(tree.startNode).toBe('a')
    expect(tree.nodes.a.text).toBe('hi')
    expect(tree.nodes.a.choices ?? []).toEqual([])
  })

  it('defaults missing nodes to an empty record', () => {
    const tree = parseDialog({ dialogId: 'd', startNode: 'a' })
    expect(tree.nodes).toEqual({})
  })

  it('throws when dialogId is missing', () => {
    expect(() => parseDialog({ startNode: 'a', nodes: {} })).toThrow(/dialogId/)
  })
})
