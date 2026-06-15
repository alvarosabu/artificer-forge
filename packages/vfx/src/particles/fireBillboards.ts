import { AdditiveBlending, DoubleSide, InstancedMesh, Matrix4, PlaneGeometry } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, cameraPosition, clamp, color, float, floor, hash, instanceIndex, mix, mod,
  modelWorldMatrix, mul, mx_fractal_noise_float, normalize, positionLocal,
  positionWorld, pow, sin, smoothstep, texture as textureNode, time, uv, vec2,
  vec3, vec4,
} from 'three/tsl'
import type { DataTexture, Texture } from 'three'

const FLIP_COLS = 16
const FLIP_ROWS = 4
const FLIP_FPS = 24

/**
 * Instanced vertical flame billboards concentrated within a spawn radius.
 *
 * Position the returned mesh at the fire pool's world center — all billboards
 * are distributed within ±spawnRadius of that origin, so they stay over the
 * fire area. Each billboard is cylindrically camera-facing, so it stays visible
 * from any orbit angle without going edge-on.
 *
 * Usage:
 *   const { mesh } = createFireBillboards(WIDTH, DEPTH, fireTexture, 60, 1.5)
 *   mesh.position.set(firePoolX, 0, firePoolZ)
 *   // In template: <primitive :object="mesh" />
 */
export function createFireBillboards(
  fieldWidth: number,
  fieldDepth: number,
  fireTex: DataTexture,
  count = 60,
  spawnRadius = 1.5,
  flipbookTex?: Texture,
): { mesh: InstancedMesh } {
  const geo = new PlaneGeometry(0.9, 1.6)

  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending
  mat.side = DoubleSide

  const i = instanceIndex.toFloat()

  // Per-billboard random streams — all within ±spawnRadius of mesh origin
  const diam = float(spawnRadius * 2)
  const randX     = hash(i).mul(diam).sub(float(spawnRadius))
  const randZ     = hash(i.add(float(19))).mul(diam).sub(float(spawnRadius))
  const randPhase = hash(i.add(float(53))).mul(float(Math.PI * 2))
  const randScale = hash(i.add(float(7))).mul(float(0.5)).add(float(0.8)) // 0.8–1.3×

  // Sway + flicker
  const sway = sin(time.mul(float(1.2)).add(randPhase)).mul(float(0.12))
  const flicker = float(0.75).add(sin(time.mul(float(3.0)).add(randPhase)).mul(float(0.25)))

  // Billboard pivot (instance origin) — Y at 0.8*scale so base sits on ground
  const pivotObj = vec3(randX.add(sway), float(0.8).mul(randScale), randZ)
  const pivotWorld = modelWorldMatrix.mul(vec4(pivotObj, float(1))).xyz

  // Cylindrical billboarding: each quad faces the camera horizontally while
  // staying upright. Prevents quads from going edge-on (and vanishing) as the
  // camera orbits, and removes the crosshatch artifact of fixed facings.
  const toCam = normalize(vec3(
    cameraPosition.x.sub(pivotWorld.x),
    float(0),
    cameraPosition.z.sub(pivotWorld.z),
  ))
  const right = vec3(toCam.z, float(0), toCam.x.negate())
  const billboardVert = right.mul(positionLocal.x)
    .add(vec3(float(0), positionLocal.y, float(0)))

  // Place billboard at its world pivot
  mat.positionNode = billboardVert.add(pivotObj)

  // Fire presence — positionWorld includes the mesh's .position offset,
  // so this correctly samples the fire texture at the billboard's world XZ.
  const halfW = float(fieldWidth / 2)
  const halfD = float(fieldDepth / 2)
  // Map world XZ straight to texture UV. No V-flip here: the surface planes need
  // one because their geometry is rotateX(-π/2) (which inverts v), but this sampler
  // reads world Z directly — same orientation as packFire's row order.
  const fireU = positionWorld.x.add(halfW).div(float(fieldWidth))
  const fireV = positionWorld.z.add(halfD).div(float(fieldDepth))
  const firePresence = textureNode(fireTex, vec2(fireU, fireV)).r

  // --- Two-pass flame shader (same pattern as buildFireSurfaceMaterial) ---
  // positionWorld.xz drives world-space noise so adjacent billboards have
  // coherent flame patterns. uv().y = 0 at base → 1 at tip for height fade.

  const warpPos = add(
    mul(positionWorld.xz, float(1.5)),
    vec2(time.mul(float(0.15)), time.mul(float(-0.3))),
  )
  const warpNoise = mx_fractal_noise_float(warpPos, 2, 2.0, 0.5)
    .mul(float(0.5)).add(float(0.5))
  const warp = warpNoise.sub(float(0.5)).mul(float(0.35))

  const flamePos = add(
    mul(positionWorld.xz, float(3.5)),
    vec2(warp, time.mul(float(-2.5))),
  )
  const rawFlame = mx_fractal_noise_float(flamePos, 4, 2.0, 0.5)
  const flame = clamp(rawFlame.mul(float(0.5)).add(float(0.5)), float(0), float(1))

  // Height fade: full at base (uv.y=0), tapers to tongue tip (uv.y=1)
  const heightFade = pow(uv().y.oneMinus(), float(1.5))
  // Side fade: full at center, linear falloff to zero at edges — prevents the
  // rectangular quad outline from showing through the flame texture
  const edgeX = uv().x.sub(float(0.5)).abs().mul(float(2)) // 0 center → 1 side
  const sideFade = float(1).sub(edgeX)
  const shapeFade = heightFade.mul(sideFade)
  const flameMask = flame.mul(shapeFade).mul(firePresence).mul(flicker)
  const fireMask = smoothstep(float(0.15), float(0.6), flameMask)

  const heat = flame
  const fireCol = mix(
    mix(color('#bb1100'), color('#ff4400'), smoothstep(float(0.0), float(0.45), heat)),
    mix(color('#ffaa00'), color('#fffce0'), smoothstep(float(0.65), float(1.0), heat)),
    smoothstep(float(0.4), float(0.65), heat),
  )
  const emissiveIntensity = mix(float(2.5), float(1.5), uv().y)

  if (flipbookTex) {
    const frame = floor(time.mul(float(FLIP_FPS))).mod(float(FLIP_COLS * FLIP_ROWS))
    const col = mod(frame, float(FLIP_COLS))
    // TGA rows run top→bottom; UV y=0 is bottom — invert so frame 0 is top-left
    const row = float(FLIP_ROWS - 1).sub(floor(frame.div(float(FLIP_COLS))))
    const frameUv = vec2(
      uv().x.div(float(FLIP_COLS)).add(col.div(float(FLIP_COLS))),
      uv().y.div(float(FLIP_ROWS)).add(row.div(float(FLIP_ROWS))),
    )
    const flipSample = textureNode(flipbookTex, frameUv)
    // Luminance-based opacity: dark backgrounds vanish under additive blending,
    // bright flame cores add their color — no reliance on alpha channel format.
    const luma = flipSample.r.mul(float(0.1126))
      .add(flipSample.g.mul(float(0.7152)))
      .add(flipSample.b.mul(float(0.0722)))
    const flipAlpha = luma.mul(firePresence).mul(flicker)
    mat.colorNode = flipSample.rgb
    mat.emissiveNode = mul(flipSample.rgb, mul(flipAlpha, emissiveIntensity))
    mat.opacityNode = flipAlpha
  }
  else {
    mat.colorNode = fireCol
    mat.emissiveNode = mul(fireCol, mul(fireMask, emissiveIntensity))
    mat.opacityNode = fireMask
  }

  const mesh = new InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false

  const identity = new Matrix4()
  for (let j = 0; j < count; j++) {
    mesh.setMatrixAt(j, identity)
  }
  mesh.instanceMatrix.needsUpdate = true

  return { mesh }
}
