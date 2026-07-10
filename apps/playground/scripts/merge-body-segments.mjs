// Merge per-segment body GLBs (Blender exports one file per segment, each
// carrying its own copy of the skeleton) into the single segmented body GLB
// the part pipeline expects (like HUM_M_MEDIUM_Body_A.glb): one skeleton,
// segment meshes as named nodes, one deduped skin atlas.
//
//   node scripts/merge-body-segments.mjs <out.glb> <segment.glb...>
//   node scripts/merge-body-segments.mjs \
//     public/models/characters/bodies/GOB_M_SMALL_Body_A.glb \
//     public/models/characters/misc/GOB_M_*.glb

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, mergeDocuments, prune, unpartition } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'

const [out, first, ...rest] = process.argv.slice(2)
if (!out || !first) {
  console.error('usage: merge-body-segments.mjs <out.glb> <segment.glb...>')
  process.exit(1)
}

// Decoder only — output is written uncompressed.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
const doc = await io.read(first)
const root = doc.getRoot()
const scene = root.getDefaultScene() ?? root.listScenes()[0]

// Bone lookup on the kept (first) skeleton — segment skins rebind onto it.
const boneByName = new Map()
scene.traverse((node) => {
  if (node.getName()) boneByName.set(node.getName(), node)
})

for (const file of rest) {
  const src = await io.read(file)
  mergeDocuments(doc, src) // appends src as an extra scene in doc

  const extraScene = root.listScenes().at(-1)
  const meshNodes = []
  extraScene.traverse((node) => {
    if (node.getMesh()) meshNodes.push(node)
  })
  if (!meshNodes.length) console.warn(`no mesh in ${file}`)

  for (const meshNode of meshNodes) {
    // New skin pointing at the kept skeleton's bones (same names/order source:
    // all segments export from one blend file), reusing the segment's own
    // inverse bind matrices.
    const oldSkin = meshNode.getSkin()
    if (oldSkin) {
      const skin = doc.createSkin()
      for (const joint of oldSkin.listJoints()) {
        const bone = boneByName.get(joint.getName())
        if (!bone) throw new Error(`${file}: joint ${joint.getName()} missing from kept skeleton`)
        skin.addJoint(bone)
      }
      skin.setInverseBindMatrices(oldSkin.getInverseBindMatrices())
      meshNode.setSkin(skin)
    }
    scene.addChild(meshNode) // reparent out of the duplicate hierarchy
  }
  extraScene.dispose() // duplicate skeleton and all — prune sweeps the orphans
}

// Draco stays read-side: drop the extension so writing needs no encoder.
root.listExtensionsUsed()
  .filter(ext => ext.extensionName === 'KHR_draco_mesh_compression')
  .forEach(ext => ext.dispose())

await doc.transform(dedup(), prune(), unpartition())

const scenes = root.listScenes()
console.log(`${out}: ${scenes.length} scene(s), meshes:`)
scene.traverse((n) => { if (n.getMesh()) console.log(' -', n.getName()) })

await io.write(out, doc)
