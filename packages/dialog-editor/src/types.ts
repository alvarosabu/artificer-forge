export interface DialogCheck { skill: string, dc: number, advantage?: boolean }

export interface DialogBranch { next?: string, effects?: Record<string, unknown>[] }

export interface DialogChoice {
  text: string
  tagPrefix?: string
  conditions?: Record<string, unknown>[]
  check?: DialogCheck
  next?: string
  onSuccess?: DialogBranch
  onFailure?: DialogBranch
  effects?: Record<string, unknown>[]
  lockedDisplay?: 'hide' | 'lock'
}

export interface DialogNode {
  speaker?: string
  text: string
  textVariants?: { if: Record<string, unknown>, text: string }[]
  cameraShot?: 'three-quarter' | 'over-shoulder' | 'closeup' | 'wide' | 'two-shot'
  cameraTarget?: string
  choices?: DialogChoice[]
  effects?: Record<string, unknown>[]
}

export interface DialogTree {
  dialogId: string
  startNode: string
  nodes: Record<string, DialogNode>
}

export type DiagnosticKind = 'broken-link' | 'unreachable' | 'dead-end' | 'missing-start'
export interface Diagnostic { kind: DiagnosticKind, nodeId?: string, message: string }

export interface NodePosition { x: number, y: number }
export type LayoutMap = Record<string, NodePosition>
