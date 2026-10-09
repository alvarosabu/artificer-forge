import { Box3, Euler, Mesh, Object3D, Quaternion, Vector3 } from 'three'

export interface PalmCrownExtractOptions {
    /** Node-name prefixes that mark a palm crown. Matched with startsWith against the glTF NODE name. */
    namePrefix?: string | string[]
    /** Frond length relative to the marker radius. The marker shows where the crown sits, not how far it reaches. */
    frondScale?: number
}

// startsWith, so this also matches `Palm_Fronds` and Blender's `.001` duplicates
const DEFAULT_PREFIXES = ['Palm_Frond']

/**
 * Turn palm crown marker meshes into `PalmFronds` references.
 *
 * A crown is authored in Blender as a plain sphere sitting on the trunk tip, there only to
 * carry a position, a yaw and a size. All three come from the marker's local BOUNDING BOX:
 * - frond origin = the bottom centre of the box, where the sphere rests on the trunk. Taken in
 *   the marker's own space, so a marker tilted with a leaning trunk still lands on the tip
 * - frond length = the box's largest half extent, in world units, times `frondScale`
 * - yaw = the marker's world yaw. An applied transform loses it, and every crown then faces
 *   the same way
 *
 * Not geometry.boundingSphere: GLTFLoader fills it from the accessor min/max box, so its
 * radius is half the box DIAGONAL (1.59 for a unit icosphere). Hanging the crown that far
 * below the centre put it a metre down the trunk.
 *
 * The markers are hidden, not detached. useGLTF caches the scene by url, so a detached marker
 * is gone when the same scene is read again after a remount or HMR, and the crowns with it.
 */
export function extractPalmCrownReferences(root: Object3D, options: PalmCrownExtractOptions = {}): Object3D[] {
    const { namePrefix = DEFAULT_PREFIXES, frondScale = 1 } = options
    const prefixes = Array.isArray(namePrefix) ? namePrefix : [namePrefix]

    root.updateMatrixWorld(true)

    const references: Object3D[] = []
    const box = new Box3()
    const size = new Vector3()
    const quaternion = new Quaternion()
    const euler = new Euler()

    root.traverse((child) => {
        if (!(child instanceof Mesh) || !prefixes.some(prefix => child.name.startsWith(prefix))) return

        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
        box.copy(child.geometry.boundingBox!)
        if (box.isEmpty()) return

        const radius = box.getSize(size).multiplyScalar(0.5).toArray().reduce((a, b) => Math.max(a, b))
        child.getWorldQuaternion(quaternion)

        const reference = new Object3D()
        reference.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).applyMatrix4(child.matrixWorld)
        // YXZ isolates the yaw; the marker's tilt is dropped because the frond shader assumes an upright crown
        reference.rotation.y = euler.setFromQuaternion(quaternion, 'YXZ').y
        reference.scale.setScalar(radius * child.matrixWorld.getMaxScaleOnAxis() * frondScale)
        reference.updateMatrixWorld()
        references.push(reference)

        child.visible = false
    })

    return references
}
