export interface DialogChoice {
  text: string
  /** The node this choice leads to. Without it the choice ends the dialog. */
  next?: string
}

export interface DialogNode {
  /** A speaker id from `SPEAKERS`. Without it the node has no name tag. */
  speaker?: string
  text: string
  choices?: DialogChoice[]
}

export interface DialogTree {
  dialogId: string
  startNode: string
  nodes: Record<string, DialogNode>
}

export interface TextSegment {
  text: string
  highlight: boolean
}

const HIGHLIGHT = /\*([^*]+)\*/g

/** Splits node text on `*word*` marks. A `*` without a pair stays as text. */
export function parseHighlights(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0
  for (const match of text.matchAll(HIGHLIGHT)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), highlight: false })
    segments.push({ text: match[1]!, highlight: true })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), highlight: false })
  return segments
}
