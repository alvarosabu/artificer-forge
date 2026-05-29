import type { Diagnostic, DialogChoice, DialogTree } from '../../types'

const END = '__end'

function choiceTargets(choice: DialogChoice): string[] {
  const t: string[] = []
  if (choice.next) t.push(choice.next)
  if (choice.onSuccess?.next) t.push(choice.onSuccess.next)
  if (choice.onFailure?.next) t.push(choice.onFailure.next)
  return t
}

export function validateTree(tree: DialogTree): Diagnostic[] {
  const out: Diagnostic[] = []
  const ids = new Set(Object.keys(tree.nodes))

  if (!ids.has(tree.startNode)) {
    out.push({ kind: 'missing-start', message: `startNode "${tree.startNode}" does not exist` })
  }

  // Broken links + dead-ends.
  for (const [id, node] of Object.entries(tree.nodes)) {
    const choices = node.choices ?? []
    if (choices.length === 0) {
      out.push({ kind: 'dead-end', nodeId: id, message: `node "${id}" has no choices` })
    }
    for (const choice of choices) {
      for (const target of choiceTargets(choice)) {
        if (target !== END && !ids.has(target)) {
          out.push({ kind: 'broken-link', nodeId: id, message: `choice points to missing node "${target}"` })
        }
      }
    }
  }

  // Reachability from startNode (BFS over valid targets).
  const seen = new Set<string>()
  const queue: string[] = ids.has(tree.startNode) ? [tree.startNode] : []
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const choice of tree.nodes[id]?.choices ?? []) {
      for (const target of choiceTargets(choice)) {
        if (target !== END && ids.has(target) && !seen.has(target)) queue.push(target)
      }
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) out.push({ kind: 'unreachable', nodeId: id, message: `node "${id}" is unreachable from startNode` })
  }

  return out
}
