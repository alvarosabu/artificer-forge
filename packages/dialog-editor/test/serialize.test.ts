import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import type { DialogTree } from '../src/types'
import { serializeDialog } from '../src/runtime/utils/serialize'
import { parseDialog } from '../src/runtime/utils/parse'

const tree: DialogTree = {
  dialogId: 'zynrae_alley',
  startNode: 'greeting',
  nodes: {
    greeting: {
      speaker: 'zynrae',
      text: 'State your name.',
      cameraShot: 'two-shot',
      choices: [
        { text: 'No threat.', next: 'pitch' },
        { text: '[Study]', tagPrefix: 'INSIGHT', check: { skill: 'insight', dc: 12 }, onSuccess: { next: 'read' }, onFailure: { next: '__end' } },
      ],
    },
    pitch: { speaker: 'zynrae', text: 'Talk fast.', choices: [{ text: 'Coin.', next: '__end' }] },
    read: { speaker: 'zynrae', text: 'Sharp eyes.', choices: [{ text: 'Bye', next: '__end' }] },
  },
}

describe('serializeDialog', () => {
  it('produces YAML that round-trips back to the same tree', () => {
    const yaml = serializeDialog(tree)
    const round = parseDialog(parseYaml(yaml))
    expect(round.dialogId).toBe(tree.dialogId)
    expect(round.startNode).toBe(tree.startNode)
    expect(round.nodes.greeting.choices).toHaveLength(2)
    expect(round.nodes.greeting.choices![1].check).toEqual({ skill: 'insight', dc: 12 })
    expect(round.nodes.greeting.choices![1].onSuccess).toEqual({ next: 'read' })
    expect(round.nodes.pitch.text).toBe('Talk fast.')
  })

  it('omits undefined keys (no "null" noise)', () => {
    const yaml = serializeDialog(tree)
    expect(yaml).not.toContain('null')
    expect(yaml).not.toContain('undefined')
  })

  it('starts with dialogId then startNode for readable diffs', () => {
    const yaml = serializeDialog(tree)
    expect(yaml.indexOf('dialogId')).toBeLessThan(yaml.indexOf('startNode'))
    expect(yaml.indexOf('startNode')).toBeLessThan(yaml.indexOf('nodes'))
  })
})
