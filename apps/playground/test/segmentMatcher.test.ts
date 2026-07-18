import { describe, expect, it } from 'vitest'
import { segmentMatcher } from '@artificer-forge/engine/runtime'

describe('segmentMatcher', () => {
  const bodyChildren = ['HUM_M_ArmL_A', 'HUM_M_ArmR_A', 'HUM_M_HandR_A', 'HUM_M_Torso_A', 'HUM_M_LegL_A']

  it('sided keys hit exactly one side', () => {
    const matches = bodyChildren.filter(n => segmentMatcher('armR').test(n))
    expect(matches).toEqual(['HUM_M_ArmR_A'])
  })

  it('side-agnostic keys hit both sides', () => {
    const matches = bodyChildren.filter(n => segmentMatcher('arm').test(n))
    expect(matches).toEqual(['HUM_M_ArmL_A', 'HUM_M_ArmR_A'])
  })

  it('does not cross-match segments (arm vs hand, torso unsided)', () => {
    expect(bodyChildren.filter(n => segmentMatcher('handR').test(n))).toEqual(['HUM_M_HandR_A'])
    expect(bodyChildren.filter(n => segmentMatcher('torso').test(n))).toEqual(['HUM_M_Torso_A'])
  })
})
