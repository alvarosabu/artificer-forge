import { describe, expect, it } from 'vitest'
import { portraitSignature } from '../utils/portraitSignature'

describe('portraitSignature', () => {
  it('is stable for identical appearance', () => {
    const a = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: { mainHand: 'dagger', offHand: 'dagger' } }
    const b = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: { mainHand: 'dagger', offHand: 'dagger' } }
    expect(portraitSignature(a)).toBe(portraitSignature(b))
  })

  it('changes when equipment changes', () => {
    const base = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: { mainHand: 'dagger' } }
    const swapped = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: { mainHand: 'sword' } }
    expect(portraitSignature(base)).not.toBe(portraitSignature(swapped))
  })

  it('changes when model changes', () => {
    const a = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: {} }
    const b = { model: '/m/zynrae.glb', rig: 'Rig_Medium', equipment: {} }
    expect(portraitSignature(a)).not.toBe(portraitSignature(b))
  })

  it('treats missing fields as empty without throwing', () => {
    expect(portraitSignature({ equipment: {} })).toBe('|||')
  })
})
