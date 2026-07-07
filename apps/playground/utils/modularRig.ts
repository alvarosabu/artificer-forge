import { Box3, type Material, type Mesh, type Object3D, Vector3 } from 'three'

// Shared helpers for the modular-character rig, used by the live preview
// (CharacterPreview) and the offscreen thumbnail studio (ThumbStudio).

// Default colors used ONLY for thumbnails, independent of the user's chosen
// colors — so a thumbnail always reads the same way regardless of current tint.
export const THUMB_HEAD_GRAY = '#8a8a8a' // neutral head, so hair/beard/brows pop
export const THUMB_SKIN = '#c9a37f' // shown on head-variant thumbnails
export const THUMB_HAIR = '#5a3b22' // default brown for hair/beard/brows
export const THUMB_HORN = '#4a3a35' // dark keratin for horn thumbnails (GLB ships light gray)

// Clone every material named `name` under `root` and return the last clone, so
// the caller can tint it without mutating the shared source material.
export function tintMaterialNamed(root: Object3D, name: string): Material | undefined {
  let tint: Material | undefined
  root.traverse((o) => {
    const mesh = o as { material?: Material | Material[] }
    if (!mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((m, i) => {
      if (m.name !== name) return
      const clone = m.clone()
      if (Array.isArray(mesh.material)) mesh.material[i] = clone
      else mesh.material = clone
      tint = clone
    })
  })
  return tint
}

// Locate the head mesh in an assembled rig. Prefer a name match; used to frame
// the portrait thumbnail on the head box.
export function findHeadMesh(root: Object3D): Mesh | undefined {
  let match: Mesh | undefined
  root.traverse((o) => {
    const mesh = o as Mesh
    if (match || !mesh.isMesh || !/head/i.test(o.name)) return
    match = mesh
  })
  return match
}

export interface HeadFrame { center: [number, number, number], height: number }

// World-space head box centre + height, for frameFromHead().
export function headFrame(headMesh: Object3D): HeadFrame {
  const box = new Box3().setFromObject(headMesh)
  const center = new Vector3()
  box.getCenter(center)
  return { center: [center.x, center.y, center.z], height: Math.max(box.max.y - box.min.y, 0.001) }
}
