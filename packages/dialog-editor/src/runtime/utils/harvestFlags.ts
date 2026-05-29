import type { DialogTree } from '../../types'

// Flag-bearing keys in the DSL (see playground useDialogEngine.ts conditions + effects).
function collectFromRecord(obj: Record<string, unknown>, out: Set<string>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'flag') {
      if (typeof value === 'string') out.add(value)
      else if (value && typeof value === 'object') Object.keys(value as object).forEach(f => out.add(f))
    }
    else if (key === 'notFlag' || key === 'clearFlag') {
      out.add(String(value))
    }
    else if (key === 'setFlag' && value && typeof value === 'object') {
      Object.keys(value as object).forEach(f => out.add(f))
    }
  }
}

export function harvestFlags(trees: DialogTree[]): string[] {
  const out = new Set<string>()
  for (const tree of trees) {
    for (const node of Object.values(tree.nodes)) {
      node.effects?.forEach(e => collectFromRecord(e, out))
      for (const choice of node.choices ?? []) {
        choice.conditions?.forEach(c => collectFromRecord(c, out))
        choice.effects?.forEach(e => collectFromRecord(e, out))
        choice.onSuccess?.effects?.forEach(e => collectFromRecord(e, out))
        choice.onFailure?.effects?.forEach(e => collectFromRecord(e, out))
      }
    }
  }
  return [...out]
}
