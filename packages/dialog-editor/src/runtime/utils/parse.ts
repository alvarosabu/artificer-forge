import type { DialogNode, DialogTree } from '../../types'

export function parseDialog(raw: unknown): DialogTree {
  const obj = (raw ?? {}) as Record<string, unknown>
  if (typeof obj.dialogId !== 'string') throw new Error('dialog parse: missing dialogId')
  if (typeof obj.startNode !== 'string') throw new Error('dialog parse: missing startNode')

  const rawNodes = (obj.nodes ?? {}) as Record<string, Record<string, unknown>>
  const nodes: Record<string, DialogNode> = {}
  for (const [id, n] of Object.entries(rawNodes)) {
    nodes[id] = {
      ...n,
      text: typeof n.text === 'string' ? n.text : '',
      choices: Array.isArray(n.choices) ? (n.choices as DialogNode['choices']) : undefined,
    } as DialogNode
  }

  return { dialogId: obj.dialogId, startNode: obj.startNode, nodes }
}
