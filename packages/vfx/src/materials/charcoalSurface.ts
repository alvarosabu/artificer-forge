import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, cameraViewMatrix, color, float, mix, mul, mx_fractal_noise_float,
  positionLocal, positionWorld, sin, smoothstep, texture as textureNode,
  time, uv, vec2, vec3, vec4,
} from 'three/tsl'
import type { DataTexture } from 'three'

const HUMP_FREQ = 1.8 // low-freq lumps that get displaced into real relief
const HUMP_HEIGHT = 0.22 // metres of vertical displacement at full fire coverage
const GRAIN_FREQ = 22.0 // fine albedo grain so the humps don't read as smooth blobs
const CRACK_FREQ = 7.0 // mid-freq vein noise that textures the glowing cracks
const NORMAL_EPS = 0.12 // world-space step for the finite-difference normal

type Vec2Node = ReturnType<typeof vec2>

/**
 * Charcoal bed for a fire surface — a SEPARATE subdivided plane that is actually
 * displaced vertically, so the lumps have real silhouette and catch light. The
 * shared surface-map plane can't do this: it's 1-segment and also carries the
 * water/oil/poison pools, which must stay flat.
 *
 * Why displacement, not a normal/bump map: a bump only tilts lighting on a
 * surface you already perceive as flat — it can't add silhouette or parallax,
 * and on near-black charcoal albedo the lit signal is sub-perceptual anyway.
 *
 * Mesh contract: full-field PlaneGeometry, rotateX(-PI/2), positioned at x=0,z=0
 * (any Y). XZ-at-origin is what lets the vertex use positionLocal.xz and the
 * fragment use positionWorld.xz interchangeably for the noise — keep it there.
 */
export function buildCharcoalSurfaceMaterial(fireTex: DataTexture): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  // Opaque bed via alphaTest, not blending: the charcoal is a solid surface, so it
  // must write depth and sort against the fire billboards by geometry (flame behind
  // a hump is occluded). A transparent bed has depthWrite off and only sorts by draw
  // order, so it "competes" with the additive flames as the camera orbits. alphaTest
  // discards the off-pool fringe (alpha < threshold) so it still never writes depth
  // over — and occludes — the pools below.
  mat.alphaTest = 0.5
  mat.roughness = 0.95

  const fieldUv = vec2(uv().x, uv().y.oneMinus()) // V flip matches packFire orientation

  // The height field that becomes geometry. Same fn for vertex displacement and
  // the fragment-side normal so the lighting matches the actual surface.
  const humpAt = (xz: Vec2Node) =>
    mx_fractal_noise_float(xz.mul(float(HUMP_FREQ)), 3, 2.0, 0.5).mul(0.5).add(0.5)

  // --- VERTEX: displace up by hump × fire coverage ---
  // texture() in the vertex stage resolves to LOD 0 (the DataTexture has no mips).
  const fireMaskV = textureNode(fireTex, fieldUv).r
  const dispV = humpAt(positionLocal.xz).mul(fireMaskV).mul(float(HUMP_HEIGHT))
  mat.positionNode = positionLocal.add(vec3(float(0), dispV, float(0)))

  // --- FRAGMENT ---
  const fireAmt = textureNode(fireTex, fieldUv).r
  const p = positionWorld.xz
  const hump = humpAt(p)

  // Three.js does NOT recompute normals after a vertex-shader displacement, so
  // without this the humps would be lit as if flat. Finite-difference the same
  // hump function: surface y = h(x,z) → normal ∝ (-dh/dx, 1, -dh/dz). Carrying
  // the eps in the y-slot clears the divide-by-eps.
  const e = float(NORMAL_EPS)
  const scale = fireAmt.mul(float(HUMP_HEIGHT))
  const dx = humpAt(p.add(vec2(e, float(0)))).sub(hump).mul(scale)
  const dz = humpAt(p.add(vec2(float(0), e))).sub(hump).mul(scale)
  const worldN = vec3(dx.negate(), e, dz.negate()).normalize()
  // normalNode expects view space; the view matrix is orthonormal, so a w=0
  // multiply is a pure direction transform (no translation).
  mat.normalNode = cameraViewMatrix.mul(vec4(worldN, float(0))).xyz.normalize()

  // Albedo: ash-gray on the lit hump tops, warm-black down in the valleys.
  const ashRidge = smoothstep(float(0.2), float(0.85), hump)
  const grain = mx_fractal_noise_float(mul(p, float(GRAIN_FREQ)), 2, 2.0, 0.5).mul(0.5).add(0.5)
  const ash = ashRidge.mul(grain.mul(float(0.5)).add(float(0.5)))
  mat.colorNode = mix(color('#070503'), color('#4a4038'), ash.mul(float(0.85)))

  // Glow lives in the VALLEYS between humps (real charcoal glows in the crevices,
  // not on the raised faces). Crack detail textures the molten cracks; the ember
  // pulse breathes the brightness without moving it.
  const valley = hump.oneMinus()
  const crackDetail = mx_fractal_noise_float(mul(p, float(CRACK_FREQ)), 4, 2.0, 0.65).mul(0.5).add(0.5)
  const glowMask = smoothstep(
    float(0.4), float(0.85),
    valley.mul(crackDetail.mul(float(0.5)).add(float(0.5))),
  )
  // Spatial phase offset so embers flicker out of sync across the bed instead of
  // breathing in unison. Two out-of-phase sines, range [0.4,1] — a deeper, livelier
  // pulse than a single global dimmer.
  const pulsePhase = mx_fractal_noise_float(mul(p, float(0.6)), 2, 2.0, 0.5).mul(float(Math.PI * 2))
  const emberPulse = add(
    sin(time.mul(float(1.6)).add(pulsePhase)).mul(float(0.5)).add(float(0.5)).mul(float(0.7)),
    sin(time.mul(float(3.1)).add(pulsePhase.mul(float(1.7)))).mul(float(0.5)).add(float(0.5)).mul(float(0.3)),
  ).mul(float(0.6)).add(float(0.4))
  const heat = smoothstep(float(0.25), float(0.85), fireAmt)
  const crackCol = mix(color('#5a0a00'), color('#ff6a1a'), heat)
  mat.emissiveNode = mul(crackCol, mul(glowMask, mul(emberPulse, mul(float(3.0), fireAmt))))

  // Only render inside the fire field — soft noisy edge from the coverage itself.
  mat.opacityNode = smoothstep(float(0.05), float(0.4), fireAmt)

  return mat
}
