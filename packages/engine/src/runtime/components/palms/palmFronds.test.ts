import { describe, expect, it } from 'vitest'
import { DoubleSide, Object3D } from 'three'
import { createPalmFronds } from './palmFronds'

/**
 * Regression guard for a silent shadow bug. three flips a FrontSide material to BackSide
 * while filling the shadow map. A frond is a single-sided strip with no back shell, so the
 * fronds turned away from the light would write nothing, with no error or warning.
 */
describe('palm fronds material', () => {
    it('renders both faces in the shadow pass', () => {
        const reference = new Object3D()
        reference.updateMatrixWorld()

        const { material, dispose } = createPalmFronds({ references: [reference] })

        expect(material.shadowSide).toBe(DoubleSide)

        dispose()
    })
})
