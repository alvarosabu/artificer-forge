import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { Color } from 'three'
import { texture, uniform } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { GradingContext } from './grading'
import { stylizedOutput } from './stylizedOutput'

/**
 * Swaps a loaded model's materials (GLB PBR) for unlit graded equivalents:
 * baseColorTexture/color becomes the finish's base color, lighting comes from
 * the grading (skinning is untouched — NodeMaterial applies it automatically).
 * Shared source materials stay shared: one graded material per source.
 */
export function applyGradingToModel(root: Object3D, grading: GradingContext) {
    const graded = new Map<Material, MeshBasicNodeMaterial>()

    root.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        const mesh = child as Mesh
        if (Array.isArray(mesh.material)) return // multi-material meshes: none in our GLBs, skip rather than guess
        const source = mesh.material
        if (source.userData.graded) return // idempotent: re-running a watch must not grade a graded material

        let material = graded.get(source)
        if (!material) {
            material = new MeshBasicNodeMaterial()
            material.side = source.side
            material.userData.graded = true

            const std = source as MeshStandardMaterial
            const tint = uniform(new Color(std.color ?? '#ffffff'))
            const baseColor = std.map ? texture(std.map).rgb.mul(tint) : tint
            material.outputNode = stylizedOutput(baseColor, grading, { hasMidTone: true })

            graded.set(source, material)
        }
        mesh.material = material
    })
}
