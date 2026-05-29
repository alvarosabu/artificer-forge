import type { RigSize } from '@artificer-forge/composables'

export interface PortraitFraming {
  cameraPosition: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

// Head/bust framing per rig type. Tuned by eye later.
export const PORTRAIT_FRAMING: Record<RigSize, PortraitFraming> = {
  Medium: { cameraPosition: [0, 1.62, 1.15], lookAt: [0, 1.5, 0], fov: 28 },
  Large: { cameraPosition: [0, 1.32, 1.15], lookAt: [0, 1.24, 0], fov: 30 },
}

export function framingForRig(rig?: string): PortraitFraming {
  const size = (rig?.replace('Rig_', '') ?? 'Medium') as RigSize
  return PORTRAIT_FRAMING[size] ?? PORTRAIT_FRAMING.Medium
}
