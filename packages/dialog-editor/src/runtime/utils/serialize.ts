import { stringify } from 'yaml'
import type { DialogTree } from '../../types'

// Serialize a working tree to YAML. JSON round-trip first to drop `undefined`
// keys (so optional fields don't surface as `null`), then stringify with a
// stable top-level key order for readable diffs.
//
// NOTE: comments in the source file are NOT preserved (accepted tradeoff).
export function serializeDialog(tree: DialogTree): string {
  const plain = JSON.parse(JSON.stringify({
    dialogId: tree.dialogId,
    startNode: tree.startNode,
    nodes: tree.nodes,
  }))
  return stringify(plain, { lineWidth: 0 })
}
