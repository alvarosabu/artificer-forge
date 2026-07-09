import { describe, expect, it } from 'vitest'
import { portraitSignature } from './portraitSignature'

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

  it('changes when the backdrop changes', () => {
    const base = { model: '/m/hero.glb', rig: 'Rig_Medium', equipment: {} }
    const withBg = { ...base, background: '/img/portraits/bgs/blue-storm.png' }
    expect(portraitSignature(base)).not.toBe(portraitSignature(withBg))
  })

  it('treats missing fields as empty without throwing', () => {
    expect(portraitSignature({ equipment: {} })).toBe('v8|||||||')
  })

  it('changes when a modular appearance part changes', () => {
    const appearance = { body: 'HUM_M_Body_A', head: 'HUM_M_Head_A', hair: 'GEN_M_Hair_Long_A', beard: null, eyebrows: null, horns: null, skinColor: '#eecbb0', hairColor: '#2c222b' }
    const a = { equipment: {}, appearance }
    const b = { equipment: {}, appearance: { ...appearance, hair: 'GEN_M_Hair_Short_A' } }
    expect(portraitSignature(a)).not.toBe(portraitSignature(b))
  })

  it('changes when a modular armor piece or its tint changes', () => {
    const armor = [{ id: 'ARM_M_Cedric_Padded', path: '/m/a.glb', hides: ['torso'] }]
    const a = { equipment: {}, armor }
    const b = { equipment: {}, armor: [{ ...armor[0], tint: '/t/crimson.png' }] }
    const c = { equipment: {}, armor: [] }
    expect(portraitSignature(a)).not.toBe(portraitSignature(b))
    expect(portraitSignature(a)).not.toBe(portraitSignature(c))
  })
})
