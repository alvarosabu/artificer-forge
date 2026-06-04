import { describe, expect, it } from 'vitest'
import type { DialogTree } from '../src/types'
import { validateTree } from '../src/runtime/utils/validate'

function kinds(t: DialogTree) { return validateTree(t).map(d => d.kind).sort() }

describe('validateTree', () => {
  it('flags a broken link (next to missing node)', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
      a: { text: '', choices: [{ text: 'x', next: 'ghost' }] },
    } }
    expect(validateTree(t).some(d => d.kind === 'broken-link' && d.nodeId === 'a')).toBe(true)
  })

  it('does not flag __end as a broken link', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
      a: { text: '', choices: [{ text: 'x', next: '__end' }] },
    } }
    expect(validateTree(t).some(d => d.kind === 'broken-link')).toBe(false)
  })

  it('flags unreachable nodes', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
      a: { text: '', choices: [{ text: 'x', next: '__end' }] },
      orphan: { text: '', choices: [{ text: 'y', next: '__end' }] },
    } }
    expect(validateTree(t).some(d => d.kind === 'unreachable' && d.nodeId === 'orphan')).toBe(true)
  })

  it('flags a dead-end (node with no choices, not via __end)', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'a', nodes: { a: { text: 'no choices' } } }
    expect(validateTree(t).some(d => d.kind === 'dead-end' && d.nodeId === 'a')).toBe(true)
  })

  it('flags missing startNode', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'nope', nodes: { a: { text: '' } } }
    expect(kinds(t)).toContain('missing-start')
  })

  it('follows check branches (onSuccess/onFailure) for reachability', () => {
    const t: DialogTree = { dialogId: 'd', startNode: 'a', nodes: {
      a: { text: '', choices: [{ text: 'x', check: { skill: 's', dc: 1 }, onSuccess: { next: 'b' }, onFailure: { next: '__end' } }] },
      b: { text: '', choices: [{ text: 'z', next: '__end' }] },
    } }
    expect(validateTree(t).some(d => d.kind === 'unreachable')).toBe(false)
  })
})
