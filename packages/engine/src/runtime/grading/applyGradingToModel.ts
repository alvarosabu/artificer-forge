import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { Color } from 'three'
import { normalWorld, positionWorld, texture, uniform, uv } from 'three/tsl'
import { MeshLambertNodeMaterial } from 'three/webgpu'
import type { GradingContext } from './grading'
import { createDropShadowCatcher, stylizedOutput } from './stylizedOutput'

/**
 * Swaps a loaded model's materials (GLB PBR) for graded equivalents:
 * baseColorTexture/color becomes the finish's base color, lighting comes from
 * the grading (skinning is untouched — NodeMaterial applies it automatically).
 * Lambert base ONLY so the drop-shadow catcher runs; its lighting is unused.
 * Shared source materials stay shared: one graded material per source.
 */
export function applyGradingToModel(root: Object3D, grading: GradingContext) {
    const graded = new Map<Material, MeshLambertNodeMaterial>()

    root.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        const mesh = child as Mesh
        if (Array.isArray(mesh.material)) return // multi-material meshes: none in our GLBs, skip rather than guess
        const source = mesh.material
        if (source.userData.graded) return // idempotent: re-running a watch must not grade a graded material

        let material = graded.get(source)
        if (!material) {
            material = new MeshLambertNodeMaterial()
            material.side = source.side
            material.userData.graded = true

            const std = source as MeshStandardMaterial
            const tint = uniform(new Color(std.color ?? '#ffffff'))
            const baseColor = std.map ? texture(std.map).rgb.mul(tint) : tint
            // our GLBs carry no baked AO, so approximate the two terms geometry CAN
            // tell us: down-facing surfaces lose sky light (under chin/arms/skirt),
            // and anything near the ground picks up contact occlusion (feet, sitting)
            const skyAo = normalWorld.y.negate().max(0).mul(0.5).oneMinus()
            const contactAo = positionWorld.y.smoothstep(0, 0.35).oneMinus().mul(0.6).oneMinus()
            let aoNode = skyAo.mul(contactAo)
            // baked aoMap multiplies in if a model ever ships one
            if (std.aoMap) aoNode = aoNode.mul(texture(std.aoMap, uv(std.aoMap.channel)).r)
            const dropShadow = createDropShadowCatcher()
            material.receivedShadowNode = dropShadow.receivedShadowNode
            material.outputNode = stylizedOutput(baseColor, grading, { hasMidTone: true, hasRim: true, hasSpecular: true, aoNode, dropShadowNode: dropShadow.shadowFactor })

            graded.set(source, material)
        }
        mesh.material = material
    })
}
