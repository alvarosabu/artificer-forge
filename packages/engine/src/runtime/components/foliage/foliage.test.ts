import { describe, expect, it } from 'vitest'
import { FrontSide, Object3D } from 'three'
import { createFoliage } from './foliage'

/**
 * Regression guard for a silent shadow bug. three's renderer flips a FrontSide
 * material to BackSide while filling the shadow map, which culls a camera-facing
 * billboard completely — the canopy then writes nothing, and a shadow map left at
 * its cleared depth reads as "everything is lit". No error, no warning, just no
 * shadows anywhere the canopy should have cast one.
 */
describe('foliage material', () => {
    it('keeps the front face in the shadow pass', () => {
        const reference = new Object3D()
        reference.updateMatrixWorld()

        const { material, dispose } = createFoliage({ references: [reference], amount: 4 })

        expect(material.shadowSide).toBe(FrontSide)

        dispose()
    })
})
