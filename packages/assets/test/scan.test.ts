import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { scanParts } from '../src/scan'

// scanParts only reads filenames, so empty stand-in .glb files are enough.
const dir = mkdtempSync(join(tmpdir(), 'assets-scan-'))
mkdirSync(join(dir, 'heads'))
writeFileSync(join(dir, 'heads', 'HUM_M_Head_A.glb'), '')
writeFileSync(join(dir, 'heads', 'not_a_part.glb'), '')
writeFileSync(join(dir, 'heads', 'notes.txt'), '')
mkdirSync(join(dir, 'bodies'))
writeFileSync(join(dir, 'bodies', 'GOB_M_SMALL_Body_A.glb'), '')
// no hair/beards/eyebrows/horns/accessories folders — must not throw

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('scanParts', () => {
  const manifest = scanParts(dir)

  it('collects parseable GLBs into their slot', () => {
    expect(manifest.heads.map(p => p.id)).toEqual(['HUM_M_Head_A'])
    expect(manifest.bodies.map(p => p.id)).toEqual(['GOB_M_SMALL_Body_A'])
  })

  it('skips unparseable stems and non-GLB files', () => {
    expect(manifest.heads.find(p => p.id === 'not_a_part')).toBeUndefined()
  })

  it('tolerates missing slot folders', () => {
    expect(manifest.hair).toEqual([])
    expect(manifest.accessories).toEqual([])
  })

  it('pins the canonical rig paths', () => {
    expect(manifest.rigs).toEqual({
      medium: '/models/characters/rig_medium.glb',
      small: '/models/characters/rig_small.glb',
    })
  })

  it('applies PART_OVERRIDES (goblin body stays goblin, no medium races leak)', () => {
    expect(manifest.bodies[0]!.rig).toBe('small')
  })
})
