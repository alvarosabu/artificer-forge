import { describe, expect, it } from 'vitest'
import { Bone, BufferGeometry, MeshStandardMaterial, Object3D, Skeleton, SkinnedMesh } from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { hasSkinnedMesh, rebindClone } from '../utils/modularRig'

// A minimal rig: root → hips → chest → head, like rig_small/rig_medium.
function makeRig(): { root: Object3D, boneByName: Map<string, Bone> } {
  const root = new Object3D()
  const names = ['hips', 'chest', 'head']
  const boneByName = new Map<string, Bone>()
  let parent: Object3D = root
  for (const name of names) {
    const bone = new Bone()
    bone.name = name
    parent.add(bone)
    boneByName.set(name, bone)
    parent = bone
  }
  return { root, boneByName }
}

// A skinned part bound to its OWN rig copy, the way GOB_ head/hair GLBs ship.
function makeSkinnedPart(name: string): { scene: Object3D, mesh: SkinnedMesh } {
  const { root, boneByName } = makeRig()
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshStandardMaterial({ name: 'Skin' }))
  mesh.name = name
  mesh.bind(new Skeleton([...boneByName.values()]))
  root.add(mesh)
  return { scene: root, mesh }
}

describe('hasSkinnedMesh', () => {
  it('detects skinned parts (GOB heads) vs rigid parts (medium heads)', () => {
    const { mesh } = makeSkinnedPart('GOB_M_Head_A')
    expect(hasSkinnedMesh(mesh)).toBe(true)
    const rigid = new Object3D()
    expect(hasSkinnedMesh(rigid)).toBe(false)
  })
})

describe('rebindClone', () => {
  it('rebinds every skinned mesh to the live rig bones by name', () => {
    const { mesh } = makeSkinnedPart('GOB_M_Head_A')
    const rig = makeRig()

    const group = rebindClone(mesh, rig.boneByName)

    const cloned: SkinnedMesh[] = []
    group.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) cloned.push(o as SkinnedMesh) })
    expect(cloned).toHaveLength(1)
    // Every bone resolved (no undefined holes — those crash skeleton.update at
    // render with "Cannot read properties of undefined (reading 'matrixWorld')").
    expect(cloned[0]!.skeleton.bones.every(b => !!b)).toBe(true)
    // And they are the RIG's bones, not the part's own copy.
    expect(cloned[0]!.skeleton.bones).toEqual(['hips', 'chest', 'head'].map(n => rig.boneByName.get(n)))
  })

  it('does not mutate the source part (shared GLTF cache stays pristine)', () => {
    const { scene, mesh } = makeSkinnedPart('GOB_M_Head_A')
    const sourceBones = [...mesh.skeleton.bones]
    const rig = makeRig()
    const group = rebindClone(mesh, rig.boneByName)
    expect(mesh.skeleton.bones).toEqual(sourceBones)
    expect(group.parent).toBeNull()
    expect(scene.children).not.toContain(group)
  })

  it('regression: SkeletonUtils.clone of a lone skinned node loses its bones', () => {
    // Documents WHY rebindClone exists: the old ThumbSubject path cloned the
    // bare head node, whose bones live outside the cloned subtree.
    const { mesh } = makeSkinnedPart('GOB_M_Head_A')
    const broken = skeletonClone(mesh)
    let sk: Skeleton | undefined
    broken.traverse((o) => { sk ??= (o as SkinnedMesh).skeleton })
    expect(sk!.bones.some(b => !b)).toBe(true)
  })
})
