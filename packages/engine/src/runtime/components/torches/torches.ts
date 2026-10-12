import { Box3, Mesh, Object3D } from 'three'

export interface TorchFlameExtractOptions {
    /** Node-name prefixes that mark a flame. Matched with startsWith against the glTF NODE name. */
    namePrefix?: string | string[]
}

// startsWith, so this also matches Blender's `.001` duplicates
const DEFAULT_PREFIXES = ['Torch_Flame']

/**
 * Turn torch flame marker meshes into `TorchFlames` references: origin = the bottom centre of
 * the marker's local bounding box, uniform scale = its height in world units.
 * The rotation is dropped, so a flame rises straight up from a tilted torch. The markers are
 * hidden, not detached, for the same reason as `extractPalmCrownReferences`.
 */
export function extractTorchFlameReferences(root: Object3D, options: TorchFlameExtractOptions = {}): Object3D[] {
    const { namePrefix = DEFAULT_PREFIXES } = options
    const prefixes = Array.isArray(namePrefix) ? namePrefix : [namePrefix]

    root.updateMatrixWorld(true)

    const references: Object3D[] = []
    const box = new Box3()

    root.traverse((child) => {
        if (!(child instanceof Mesh) || !prefixes.some(prefix => child.name.startsWith(prefix))) return

        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
        box.copy(child.geometry.boundingBox!)
        if (box.isEmpty()) return

        const reference = new Object3D()
        reference.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).applyMatrix4(child.matrixWorld)
        reference.scale.setScalar((box.max.y - box.min.y) * child.matrixWorld.getMaxScaleOnAxis())
        reference.updateMatrixWorld()
        references.push(reference)

        child.visible = false
    })

    return references
}
