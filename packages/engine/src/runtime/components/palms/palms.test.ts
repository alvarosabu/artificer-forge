import { describe, expect, it } from 'vitest'
import { Group, Mesh, SphereGeometry } from 'three'
import { extractPalmCrownReferences } from './palms'

// Same shape as the portfolio island: a unit sphere with its origin at its base, parented
// to a scaled and yawed trunk
function palm(name: string) {
    const trunk = new Group()
    trunk.position.set(10, 0, 5)
    trunk.rotation.y = 1
    trunk.scale.setScalar(0.5)

    const marker = new Mesh(new SphereGeometry(1).translate(0, 1, 0))
    marker.name = name
    marker.position.y = 20
    marker.scale.setScalar(4)
    trunk.add(marker)

    return { trunk, marker }
}

describe('extractPalmCrownReferences', () => {
    it('places the crown on the marker base, sized by its radius and yawed with it', () => {
        const { trunk } = palm('Palm_Frond.001')

        const [reference] = extractPalmCrownReferences(trunk)

        expect(reference!.position.x).toBeCloseTo(10)
        expect(reference!.position.y).toBeCloseTo(10)
        expect(reference!.position.z).toBeCloseTo(5)
        expect(reference!.scale.x).toBeCloseTo(2)
        expect(reference!.rotation.y).toBeCloseTo(1)
    })

    it('ignores the bounding sphere GLTFLoader inflates to the box diagonal', () => {
        const { trunk, marker } = palm('Palm_Frond')
        // what GLTFLoader leaves on a loaded icosphere: box centre, half the box diagonal
        marker.geometry.computeBoundingBox()
        marker.geometry.computeBoundingSphere()
        marker.geometry.boundingSphere!.radius = marker.geometry.boundingBox!.min.distanceTo(marker.geometry.boundingBox!.max) / 2

        const [reference] = extractPalmCrownReferences(trunk)

        expect(reference!.position.y).toBeCloseTo(10)
        expect(reference!.scale.x).toBeCloseTo(2)
    })

    it('stays on the trunk tip when the marker is tilted', () => {
        const { trunk, marker } = palm('Palm_Frond')
        marker.rotation.z = 0.3

        const [reference] = extractPalmCrownReferences(trunk)

        expect(reference!.position.x).toBeCloseTo(10)
        expect(reference!.position.y).toBeCloseTo(10)
        expect(reference!.position.z).toBeCloseTo(5)
    })

    it('scales the fronds past the marker with frondScale', () => {
        const { trunk } = palm('Palm_Frond')

        const [reference] = extractPalmCrownReferences(trunk, { frondScale: 2.5 })

        expect(reference!.scale.x).toBeCloseTo(5)
    })

    it('hides the markers but keeps them, so a cached scene still has them on the next read', () => {
        const { trunk, marker } = palm('Palm_Frond')

        extractPalmCrownReferences(trunk)

        expect(marker.visible).toBe(false)
        expect(marker.parent).toBe(trunk)
        expect(extractPalmCrownReferences(trunk)).toHaveLength(1)
    })

    it('skips meshes without the prefix', () => {
        const { trunk } = palm('Palm_Tree')

        expect(extractPalmCrownReferences(trunk)).toHaveLength(0)
    })
})
