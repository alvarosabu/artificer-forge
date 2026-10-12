import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh } from 'three'
import { extractTorchFlameReferences } from './torches'

// Same shape as the portfolio island: a 2-unit-tall marker with its origin at its base,
// scaled to a quarter on a tilted torch
function torch(name: string) {
  const pole = new Group()
  pole.position.set(10, 1, 5)
  pole.rotation.z = 0.1

  const marker = new Mesh(new BoxGeometry(0.9, 2, 0.9).translate(0, 1, 0))
  marker.name = name
  marker.position.y = 2
  marker.scale.setScalar(0.25)
  pole.add(marker)

  return { pole, marker }
}

describe('extractTorchFlameReferences', () => {
  it('places the flame on the marker base, sized by its height and kept upright', () => {
    const { pole, marker } = torch('Torch_Flame.001')

    const [reference] = extractTorchFlameReferences(pole)
    const base = marker.localToWorld(marker.position.clone().set(0, 0, 0))

    expect(reference!.position.x).toBeCloseTo(base.x)
    expect(reference!.position.y).toBeCloseTo(base.y)
    expect(reference!.position.z).toBeCloseTo(base.z)
    expect(reference!.scale.y).toBeCloseTo(0.5)
    expect(reference!.rotation.z).toBe(0)
  })

  it('hides the marker and skips other meshes', () => {
    const { pole, marker } = torch('Torch_Flame')
    pole.add(new Mesh(new BoxGeometry()))

    const references = extractTorchFlameReferences(pole)

    expect(references).toHaveLength(1)
    expect(marker.visible).toBe(false)
  })
})
