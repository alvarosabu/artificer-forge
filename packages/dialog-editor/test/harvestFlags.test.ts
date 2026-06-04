import { describe, expect, it } from 'vitest'
import type { DialogTree } from '../src/types'
import { harvestFlags } from '../src/runtime/utils/harvestFlags'

const tree: DialogTree = {
  dialogId: 'd',
  startNode: 'a',
  nodes: {
    a: {
      text: 'hi',
      choices: [
        { text: 'c1', conditions: [{ flag: 'seen_intro' }], effects: [{ setFlag: { recruited: true } }] },
        { text: 'c2', conditions: [{ notFlag: 'angry' }], onFailure: { effects: [{ clearFlag: 'recruited' }] } },
      ],
    },
    b: { text: 'bye', effects: [{ setFlag: { ended: true } }] },
  },
}

describe('harvestFlags', () => {
  it('collects unique flag names from conditions and effects across all nodes', () => {
    expect(harvestFlags([tree]).sort()).toEqual(['angry', 'ended', 'recruited', 'seen_intro'])
  })

  it('returns [] for trees with no flags', () => {
    expect(harvestFlags([{ dialogId: 'x', startNode: 'a', nodes: { a: { text: 't' } } }])).toEqual([])
  })
})
