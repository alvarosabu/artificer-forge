import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { Color } from 'three'
import { float, normalWorld, positionWorld, texture, uniform, uv } from 'three/tsl'
import { MeshLambertNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { GradingContext } from './grading'
import { createDropShadowCatcher, stylizedOutput } from './stylizedOutput'

export interface ApplyGradingOptions {
    /** Ground height under the model for the contact-occlusion term; default 0 (flat ground).
     * On terrain pass sampleHeight(field, positionWorld.xz), or the model darkens as buried. */
    groundHeight?: Node<'float'>
}

/**
 * Lambert base only so the drop-shadow catcher runs; its own lighting is unused.
 * Safe to re-run on the same tree: the graded material is cached on its source, so
 * later calls swap it back in. Base color is snapshot at first build, not tracked.
 */
export function applyGradingToModel(root: Object3D, grading: GradingContext, { groundHeight }: ApplyGradingOptions = {}) {
    root.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        const mesh = child as Mesh
        if (Array.isArray(mesh.material)) return // none in our GLBs; skip rather than guess
        const source = mesh.material
        if (source.userData.graded) return
        // Custom node materials (ghost arm, horns) keep their own look.
        if ((source as { isNodeMaterial?: boolean }).isNodeMaterial) return

        // grading and groundHeight are baked into the graph, so a cache built for
        // another scene (shared GLB material via the loader cache) must be rebuilt
        let material = source.userData.gradedMaterial as MeshLambertNodeMaterial | undefined
        const stale = material && (source.userData.gradedGrading !== grading || source.userData.gradedGround !== groundHeight)
        if (stale) {
            material!.dispose()
            material = undefined
        }
        if (!material) {
            material = new MeshLambertNodeMaterial()
            material.side = source.side
            material.userData.graded = true

            const std = source as MeshStandardMaterial
            const tint = uniform(new Color(std.color ?? '#ffffff'))
            const baseColor = std.map ? texture(std.map).rgb.mul(tint) : tint
            // No baked AO in our GLBs, so approximate: down-facing surfaces lose sky
            // light, anything near the ground picks up contact occlusion.
            const skyAo = normalWorld.y.negate().max(0).mul(0.5).oneMinus()
            const heightAboveGround = positionWorld.y.sub(groundHeight ?? float(0))
            const contactAo = heightAboveGround.smoothstep(0, 0.35).oneMinus().mul(0.6).oneMinus()
            let aoNode = skyAo.mul(contactAo)
            if (std.aoMap) aoNode = aoNode.mul(texture(std.aoMap, uv(std.aoMap.channel)).r)
            const dropShadow = createDropShadowCatcher()
            material.receivedShadowNode = dropShadow.receivedShadowNode
            material.outputNode = stylizedOutput(baseColor, grading, { hasMidTone: true, hasRim: true, hasSpecular: true, aoNode, dropShadowNode: dropShadow.shadowFactor })

            source.userData.gradedMaterial = material
            source.userData.gradedGrading = grading
            source.userData.gradedGround = groundHeight
        }
        mesh.material = material
    })
}
