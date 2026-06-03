import { describe, expect, it } from 'vitest'
import type { DialogTree } from '../src/types'
import { clearChoiceTarget, detachReferencesTo, nextNodeId, spawnConnectedNode, spliceNode, wireChoiceTarget } from '../src/runtime/utils/createNode'

function makeTree(): DialogTree {
  return {
    dialogId: 'd',
    startNode: 'a',
    nodes: {
      a: { text: 'hi', choices: [
        { text: 'go b', next: 'b' },
        { text: 'check', check: { skill: 'insight', dc: 12 }, onSuccess: { next: 'b' }, onFailure: { next: '__end' } },
      ] },
      b: { text: 'bye', choices: [{ text: 'end', next: '__end' }] },
    },
  }
}

describe('nextNodeId', () => {
  it('returns node_1 for an empty set', () => {
    expect(nextNodeId({})).toBe('node_1')
  })

  it('skips ids already in use', () => {
    expect(nextNodeId({ node_1: { text: '' }, node_2: { text: '' } })).toBe('node_3')
  })
})

describe('wireChoiceTarget', () => {
  it('points a plain choice handle at the target', () => {
    const node = makeTree().nodes.a
    expect(wireChoiceTarget(node, 'c0', 'x')).toBe(true)
    expect(node.choices![0].next).toBe('x')
  })

  it('points a check ok/fail handle at the target', () => {
    const node = makeTree().nodes.a
    wireChoiceTarget(node, 'c1-ok', 'x')
    wireChoiceTarget(node, 'c1-fail', 'y')
    expect(node.choices![1].onSuccess!.next).toBe('x')
    expect(node.choices![1].onFailure!.next).toBe('y')
  })

  it('returns false for an unrecognized handle', () => {
    expect(wireChoiceTarget(makeTree().nodes.a, 'bundle', 'x')).toBe(false)
  })
})

describe('clearChoiceTarget', () => {
  it('clears a plain choice target', () => {
    const node = makeTree().nodes.a
    expect(clearChoiceTarget(node, 'c0')).toBe(true)
    expect(node.choices![0].next).toBeUndefined()
  })

  it('clears a check ok/fail target', () => {
    const node = makeTree().nodes.a
    expect(clearChoiceTarget(node, 'c1-ok')).toBe(true)
    expect(clearChoiceTarget(node, 'c1-fail')).toBe(true)
    expect(node.choices![1].onSuccess!.next).toBeUndefined()
    expect(node.choices![1].onFailure!.next).toBeUndefined()
  })

  it('keeps the choice itself (only the target is cleared)', () => {
    const node = makeTree().nodes.a
    clearChoiceTarget(node, 'c0')
    expect(node.choices![0].text).toBe('go b')
    expect(node.choices).toHaveLength(2)
  })

  it('returns false for an unrecognized handle', () => {
    expect(clearChoiceTarget(makeTree().nodes.a, 'bundle')).toBe(false)
  })

  it('returns false when the choice has no branch to clear', () => {
    const node = makeTree().nodes.a
    expect(clearChoiceTarget(node, 'c0-ok')).toBe(false)
  })
})

describe('detachReferencesTo', () => {
  function refTree(): DialogTree {
    return {
      dialogId: 'd',
      startNode: 'start',
      nodes: {
        start: { text: '', choices: [{ text: 'go', next: 'gone' }, { text: 'stay', next: 'b' }] },
        b: { text: '', choices: [
          { text: 'chk', check: { skill: 'x', dc: 1 }, onSuccess: { next: 'gone' }, onFailure: { next: 'gone' } },
        ] },
        gone: { text: 'doomed', choices: [] },
      },
    }
  }

  it('clears plain, onSuccess and onFailure references to the removed id', () => {
    const tree = refTree()
    const count = detachReferencesTo(tree.nodes, 'gone')
    expect(count).toBe(3)
    expect(tree.nodes.start.choices![0].next).toBeUndefined()
    expect(tree.nodes.b.choices![0].onSuccess!.next).toBeUndefined()
    expect(tree.nodes.b.choices![0].onFailure!.next).toBeUndefined()
  })

  it('leaves choices that point elsewhere untouched', () => {
    const tree = refTree()
    detachReferencesTo(tree.nodes, 'gone')
    expect(tree.nodes.start.choices![1].next).toBe('b')
  })

  it('preserves the choices themselves (only targets cleared)', () => {
    const tree = refTree()
    detachReferencesTo(tree.nodes, 'gone')
    expect(tree.nodes.start.choices).toHaveLength(2)
    expect(tree.nodes.start.choices![0].text).toBe('go')
  })

  it('returns 0 when nothing references the id', () => {
    const tree = refTree()
    expect(detachReferencesTo(tree.nodes, 'nope')).toBe(0)
  })
})

describe('spawnConnectedNode', () => {
  it('creates a downstream node and wires the choice when dragging an output handle', () => {
    const tree = makeTree()
    const id = spawnConnectedNode(tree, { nodeId: 'a', handleId: 'c0', handleType: 'source' })
    expect(id).toBe('node_1')
    expect(tree.nodes.node_1).toEqual({ text: '', choices: [] })
    expect(tree.nodes.a.choices![0].next).toBe('node_1')
  })

  it('wires a check ok handle to the new downstream node', () => {
    const tree = makeTree()
    const id = spawnConnectedNode(tree, { nodeId: 'a', handleId: 'c1-ok', handleType: 'source' })
    expect(tree.nodes.a.choices![1].onSuccess!.next).toBe(id)
  })

  it('creates an upstream node with a choice pointing back when dragging an input handle', () => {
    const tree = makeTree()
    const id = spawnConnectedNode(tree, { nodeId: 'b', handleId: null, handleType: 'target' })
    expect(id).toBe('node_1')
    expect(tree.nodes.node_1.choices).toEqual([{ text: 'New choice', next: 'b' }])
  })

  it('does nothing for the collapsed bundle handle', () => {
    const tree = makeTree()
    const before = JSON.stringify(tree)
    expect(spawnConnectedNode(tree, { nodeId: 'a', handleId: 'bundle', handleType: 'source' })).toBeNull()
    expect(JSON.stringify(tree)).toBe(before)
  })
})

describe('spliceNode', () => {
  function spliceTree(): DialogTree {
    const tree = makeTree()
    tree.nodes.c = { text: 'middle', choices: [] }
    return tree
  }

  it('re-points a plain edge through C (A->C->B)', () => {
    const tree = spliceTree()
    expect(spliceNode(tree, { source: 'a', handle: 'c0', target: 'b', nodeId: 'c' })).toBe(true)
    expect(tree.nodes.a.choices![0].next).toBe('c')
    expect(tree.nodes.c.choices).toEqual([{ text: 'New choice', next: 'b' }])
  })

  it('keeps the check on A and gives C a plain choice to B (onSuccess)', () => {
    const tree = spliceTree()
    expect(spliceNode(tree, { source: 'a', handle: 'c1-ok', target: 'b', nodeId: 'c' })).toBe(true)
    expect(tree.nodes.a.choices![1].check).toBeDefined()
    expect(tree.nodes.a.choices![1].onSuccess!.next).toBe('c')
    expect(tree.nodes.c.choices).toEqual([{ text: 'New choice', next: 'b' }])
  })

  it('keeps the check on A and gives C a plain choice to B (onFailure)', () => {
    const tree = spliceTree()
    expect(spliceNode(tree, { source: 'a', handle: 'c1-fail', target: '__end', nodeId: 'c' })).toBe(true)
    expect(tree.nodes.a.choices![1].onFailure!.next).toBe('c')
    expect(tree.nodes.c.choices).toEqual([{ text: 'New choice', next: '__end' }])
  })

  it('appends to C without dropping its existing choices', () => {
    const tree = spliceTree()
    tree.nodes.c.choices = [{ text: 'keep', next: '__end' }]
    spliceNode(tree, { source: 'a', handle: 'c0', target: 'b', nodeId: 'c' })
    expect(tree.nodes.c.choices).toEqual([
      { text: 'keep', next: '__end' },
      { text: 'New choice', next: 'b' },
    ])
  })

  it('rejects splicing a node onto an edge it already terminates', () => {
    const tree = spliceTree()
    const before = JSON.stringify(tree)
    expect(spliceNode(tree, { source: 'a', handle: 'c0', target: 'b', nodeId: 'a' })).toBe(false)
    expect(spliceNode(tree, { source: 'a', handle: 'c0', target: 'b', nodeId: 'b' })).toBe(false)
    expect(JSON.stringify(tree)).toBe(before)
  })

  it('rejects an unknown node or handle without mutating', () => {
    const tree = spliceTree()
    const before = JSON.stringify(tree)
    expect(spliceNode(tree, { source: 'a', handle: 'c0', target: 'b', nodeId: 'ghost' })).toBe(false)
    expect(spliceNode(tree, { source: 'a', handle: 'bundle', target: 'b', nodeId: 'c' })).toBe(false)
    expect(JSON.stringify(tree)).toBe(before)
  })
})
