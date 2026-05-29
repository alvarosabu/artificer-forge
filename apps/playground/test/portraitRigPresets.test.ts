import { describe, expect, it } from 'vitest'
import { framingForRig, PORTRAIT_FRAMING } from '../utils/portraitRigPresets'

describe('framingForRig', () => {
  it('returns the Medium preset for Rig_Medium', () => {
    expect(framingForRig('Rig_Medium')).toBe(PORTRAIT_FRAMING.Medium)
  })

  it('returns the Large preset for Rig_Large', () => {
    expect(framingForRig('Rig_Large')).toBe(PORTRAIT_FRAMING.Large)
  })

  it('falls back to Medium for unknown or missing rig', () => {
    expect(framingForRig(undefined)).toBe(PORTRAIT_FRAMING.Medium)
    expect(framingForRig('Rig_Tiny')).toBe(PORTRAIT_FRAMING.Medium)
  })
})
