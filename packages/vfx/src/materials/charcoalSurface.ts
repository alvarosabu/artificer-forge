import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, cameraViewMatrix, color, float, mix, mul, mx_fractal_noise_float,
  positionLocal, positionWorld, sin, smoothstep, texture as textureNode,
  time, uv, vec2, vec3, vec4,
} from 'three/tsl'
import type { DataTexture } from 'three'

const HUMP_FREQ = 5.8 // low-freq lumps that get displaced into real relief
const HUMP_HEIGHT = 0.15 // metres of vertical displacement at full fire coverage
const GRAIN_FREQ = 22.0 // fine albedo grain so the humps don't read as smooth blobs
const CRACK_FREQ = 16.0 // mid-freq vein noise that textures the glowing cracks
const NORMAL_EPS = 0.12 // world-space step for the finite-difference normal
const EDGE_WARP_FREQ = 7.0 // freq of the domain warp that ragged-ies the field contour
const EDGE_WARP_AMP = 0.015 // UV-space warp magnitude — higher = more broken-up edge

type Vec2Node = ReturnType<typeof vec2>

/**
 * Charcoal bed for a fire surface — a SEPARATE subdivided plane that is actually
 * displaced vertically, so the lumps have real silhouette and catch light. The
 * shared surface-map plane can't do this: it's 1-segment and also carries the
 * water/oil/poison pools, which must stay flat.
 *π
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
  // Transparent bed, but depthWrite stays ON so it still sorts against the fire
  // billboards by geometry (flame behind a hump is occluded) — the reason it can't
  // use plain blending-with-depthWrite-off, which only sorts by draw order and
  // "competes" with the additive flames as the camera orbits. A tiny alphaTest
  // discards only the near-empty fringe, so the gradient rim (opacityNode below)
  // can fade out softly above it instead of being hard-clipped.
  mat.transparent = true
  mat.depthWrite = true
  mat.alphaTest = 0.02
  mat.roughness = 0.95

  const fieldUv = vec2(uv().x, uv().y.oneMinus()) // V flip matches packFire orientation

  // Domain warp that breaks the smooth bilinear disc into a ragged coal-bed contour
  // (the raw field reads as a round liquid puddle). Same warp is used in the vertex
  // and fragment stages so displacement stays aligned with the visible region.
  const edgeWarp = (xz: Vec2Node) =>
    vec2(
      mx_fractal_noise_float(xz.mul(float(EDGE_WARP_FREQ)), 2, 2.0, 0.5),
      mx_fractal_noise_float(xz.mul(float(EDGE_WARP_FREQ)).add(vec2(float(19.7), float(7.3))), 2, 2.0, 0.5),
    ).mul(float(EDGE_WARP_AMP))
  const warpedFieldUv = (xz: Vec2Node) => fieldUv.add(edgeWarp(xz))

  // The height field that becomes geometry. Same fn for vertex displacement and
  // the fragment-side normal so the lighting matches the actual surface.
  const humpAt = (xz: Vec2Node) =>
    mx_fractal_noise_float(xz.mul(float(HUMP_FREQ)), 3, 2.0, 0.5).mul(0.5).add(0.5)

  // --- VERTEX: displace up by hump × fire coverage ---
  // texture() in the vertex stage resolves to LOD 0 (the DataTexture has no mips).
  const fireMaskV = textureNode(fireTex, warpedFieldUv(positionLocal.xz)).r
  const dispV = humpAt(positionLocal.xz).mul(fireMaskV).mul(float(HUMP_HEIGHT))
  mat.positionNode = positionLocal.add(vec3(float(0), dispV, float(0)))

  // --- FRAGMENT ---
  const p = positionWorld.xz
  const fireAmt = textureNode(fireTex, warpedFieldUv(p)).r
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

  // Albedo: a charcoal-gray ash crust on the lit hump tops, near-black in the
  // valleys. The ash is a break-up ACCENT, not the dominant surface — too light or
  // too warm and the whole bed reads as dirt. Mid gray, slightly cool.
  const ashRidge = smoothstep(float(0.2), float(0.85), hump)
  const grain = mx_fractal_noise_float(mul(p, float(GRAIN_FREQ)), 2, 2.0, 0.5).mul(0.5).add(0.5)
  const ash = ashRidge.mul(grain.mul(float(0.5)).add(float(0.5)))
  mat.colorNode = mix(color('#0a0807'), color('#726c66'), ash)

  // Glow lives in the VALLEYS between humps (real charcoal glows in the crevices,
  // not on the raised faces). Crack detail textures the molten cracks; the ember
  // pulse breathes the brightness without moving it.
  const valley = hump.oneMinus()
  const crackDetail = mx_fractal_noise_float(mul(p, float(CRACK_FREQ)), 4, 2.0, 0.65).mul(0.5).add(0.5)
  // Glow pools broadly in the gaps between lumps (you see the incandescent interior
  // there) and fades on the ash-covered tops. Broad enough to read as hot coals;
  // the gray ash patches above are what break it up so it never floods like lava.
  const glowMask = smoothstep(
    float(0.4), float(0.82),
    valley.mul(crackDetail.mul(float(0.55)).add(float(0.45))),
  )
  // Spatial phase offset so embers flicker out of sync across the bed instead of
  // breathing in unison. Two out-of-phase sines, range [0.4,1] — a deeper, livelier
  // pulse than a single global dimmer.
  const pulsePhase = mx_fractal_noise_float(mul(p, float(0.6)), 2, 2.0, 0.5).mul(float(Math.PI * 2))
  const emberPulse = add(
    sin(time.mul(float(1.6)).add(pulsePhase)).mul(float(0.5)).add(float(0.5)).mul(float(0.7)),
    sin(time.mul(float(3.1)).add(pulsePhase.mul(float(1.7)))).mul(float(0.5)).add(float(0.5)).mul(float(0.3)),
  ).mul(float(0.6)).add(float(0.4))
  const heat = smoothstep(float(0.22), float(0.85), fireAmt)
  // Deep ember red rising to hot orange — kept off the pure-orange max so it reads
  // as incandescent coal, not molten rock. Intensity high enough to dominate the
  // ash, but broken up spatially by the glowMask + ash crust above.
  const crackCol = mix(color('#4a0800'), color('#ee4d14'), heat)
  mat.emissiveNode = mul(crackCol, mul(glowMask, mul(emberPulse, mul(float(2.4), fireAmt))))

  // Soft transparent gradient at the rim: opacity ramps over a wide coverage band
  // so the bed fades out toward the edges instead of ending on a hard line. The
  // warped fireAmt makes that fade follow the ragged contour, not a clean disc.
  mat.opacityNode = smoothstep(float(0.04), float(0.6), fireAmt)

  return mat
}
