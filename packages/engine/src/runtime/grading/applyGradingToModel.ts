import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { Color } from 'three'
import { float, normalWorld, positionWorld, texture, uniform, uv } from 'three/tsl'
import { MeshLambertNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { GradingContext } from './grading'
import { createDropShadowCatcher, stylizedOutput } from './stylizedOutput'

export interface ApplyGradingOptions {
    /**
     * World height the model rests on, as a node, for the contact-occlusion term.
     * Defaults to 0, which is right for a character on flat ground. A prop sitting
     * in a valley needs the terrain height under it, or the whole model reads as
     * 'touching the ground' and darkens: pass sampleHeight(field, positionWorld.xz).
     */
    groundHeight?: Node<'float'>
}

/**
 * Swaps a loaded model's materials (GLB PBR) for graded equivalents:
 * baseColorTexture/color becomes the finish's base color, lighting comes from
 * the grading (skinning is untouched — NodeMaterial applies it automatically).
 * Lambert base ONLY so the drop-shadow catcher runs; its lighting is unused.
 * Shared source materials stay shared: one graded material per source.
 *
 * Safe to call repeatedly on the same tree (modular rigs attach parts as they
 * load, and segment overrides restore ungraded base materials on every part
 * change): the graded material is cached on its source, so re-applying swaps
 * the cached one back in. The base color (tint × map) is snapshot when the
 * graded material is FIRST built — appearance changes after that don't reach it.
 */
export function applyGradingToModel(root: Object3D, grading: GradingContext, { groundHeight }: ApplyGradingOptions = {}) {
    root.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        const mesh = child as Mesh
        if (Array.isArray(mesh.material)) return // multi-material meshes: none in our GLBs, skip rather than guess
        const source = mesh.material
        if (source.userData.graded) return // idempotent: re-running a watch must not grade a graded material
        // Custom finishes (ghost arm, horn gradients) are node materials and
        // keep their own look — only plain GLB PBR materials get the grading.
        if ((source as { isNodeMaterial?: boolean }).isNodeMaterial) return

        let material = source.userData.gradedMaterial as MeshLambertNodeMaterial | undefined
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
            const heightAboveGround = positionWorld.y.sub(groundHeight ?? float(0))
            const contactAo = heightAboveGround.smoothstep(0, 0.35).oneMinus().mul(0.6).oneMinus()
            let aoNode = skyAo.mul(contactAo)
            // baked aoMap multiplies in if a model ever ships one
            if (std.aoMap) aoNode = aoNode.mul(texture(std.aoMap, uv(std.aoMap.channel)).r)
            const dropShadow = createDropShadowCatcher()
            material.receivedShadowNode = dropShadow.receivedShadowNode
            material.outputNode = stylizedOutput(baseColor, grading, { hasMidTone: true, hasRim: true, hasSpecular: true, aoNode, dropShadowNode: dropShadow.shadowFactor })

            source.userData.gradedMaterial = material
        }
        mesh.material = material
    })
}
