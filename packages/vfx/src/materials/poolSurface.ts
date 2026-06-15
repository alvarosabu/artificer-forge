import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, color, cos, dot, float, max, mix, mul, mx_fractal_noise_float, mx_worley_noise_vec2,
  normalView, positionViewDirection, positionWorld, smoothstep, texture as textureNode, time, uv, vec2, vec3,
} from 'three/tsl'
import type { DataTexture } from 'three'

/**
 * TSL material for the liquid-pool surface overlay (water/oil/poison/blood).
 * Accepts a DataTexture whose channels are packed by packCells:
 *   R = water, G = oil, B = poison, A = blood (0..1 coverage).
 *
 * `stateTex` carries the pool-variant state packed by packState:
 *   R = electrified charge (0..1), G = frozen (0/1). Frozen pools read as a
 *   frosted semi-opaque ice sheet; electrified pools flicker with electric arcs.
 *
 * `electricTex` (optional) is a lightning-bolt sprite (white-on-black, greyscale)
 * sampled over electrified pools — repeat-wrapped and layered into crackling arcs.
 *
 * Fire/charcoal are NOT handled here — they need vertical relief and live on
 * their own displaced meshes (buildCharcoalSurfaceMaterial / buildFireSurfaceMaterial).
 */
export function buildPoolSurfaceMaterial(
  tex: DataTexture,
  stateTex: DataTexture,
  electricTex?: import('three').Texture,
): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false // transparent overlay — writing depth here occludes the fire billboards when draw order flips on orbit
  mat.roughness = 0.9

  const fieldUv = vec2(uv().x, uv().y.oneMinus()) // keep the spike's V flip — it's load-bearing
  const amount = textureNode(tex, fieldUv)
  const water = amount.r
  const oil = amount.g
  const poison = amount.b
  const blood = amount.a

  // Slow-drifting noise breaks pool edges so they read organic, not disc-shaped.
  const edgeNoise = mx_fractal_noise_float(
    add(mul(positionWorld.xz, 1.8), time.mul(0.05)),
    3, 2.0, 0.5,
  ).mul(0.5).add(0.5)

  const maskOf = (amount: ReturnType<typeof float>) =>
    smoothstep(float(0.15), float(0.6), amount.mul(edgeNoise.mul(0.6).add(0.7)))

  const waterMask = maskOf(water)
  const oilMask = maskOf(oil)
  const poisonMask = maskOf(poison)
  const bloodMask = maskOf(blood)

  const waterCol = mix(color('#0c3b66'), color('#2f7fd0'), edgeNoise)

  // Fake thin-film iridescence: a cosine rainbow palette phased by view anglea
  // + the shared noise. Real iridescence is specular-driven and needs env
  // reflections — under flat ambient light this cheat reads better.
  const facing = dot(normalView, positionViewDirection).saturate()
  const filmPhase = edgeNoise.mul(2.5).add(facing.mul(1.5)).add(time.mul(0.06))
  const rainbow = vec3(
    cos(filmPhase.mul(Math.PI * 2)),
    cos(filmPhase.mul(Math.PI * 2).sub(2.094)), // ±120° per channel = hue wheel
    cos(filmPhase.mul(Math.PI * 2).sub(4.188)),
  ).mul(0.5).add(0.5)
  const sheen = smoothstep(float(0.35), float(0.8), edgeNoise).mul(0.55) // patchy, like a real slick
  const oilCol = mix(mix(color('#14100c'), color('#3a2f1c'), edgeNoise), rainbow, sheen)
  const poisonCol = mix(color('#176022'), color('#37d24a'), edgeNoise)
  const bloodCol = mix(color('#3d060a'), color('#6e0f14'), edgeNoise)

  // Only one kind occupies a cell — overlap only exists in the bilinear blend
  // zone between pools, where later layers win.
  const base = color('#0e1118')
  let col = mix(base, waterCol, waterMask)
  col = mix(col, oilCol, oilMask)
  col = mix(col, poisonCol, poisonMask)
  col = mix(col, bloodCol, bloodMask)

  // Per-kind opacity — kinds are exclusive per cell, so max() picks whichever
  // is active (seams briefly blend both, which reads fine).
  let opacity = max(
    waterMask.mul(0.15), // water: see the ground through it
    max(oilMask.mul(0.95), max(poisonMask.mul(0.85), bloodMask.mul(0.9))),
  )

  // --- Variant state (electrified / frozen) ---
  const state = textureNode(stateTex, fieldUv)
  const electrified = state.r
  const frozen = state.g

  // Frosted lake ice: a static (no-time) Worley cell network reads as cracked
  // plates. Crack lines sit on cell boundaries, where the two nearest feature
  // points are ~equidistant (F2-F1 → 0); two scales overlay broad plates with
  // finer fractures. Milky fractal mottling varies the plate interiors, and a
  // crack-darkened "depth" hint lets the clearer plates read as ice over water.
  const iceUv = positionWorld.xz
  const plates = mx_worley_noise_vec2(mul(iceUv, 0.7), 1, 0) // ~1.4m plates
  const fractures = mx_worley_noise_vec2(mul(iceUv, 2.1), 1, 0) // ~0.5m fractures
  const crackBroad = smoothstep(float(0), float(0.06), plates.y.sub(plates.x)).oneMinus()
  const crackFine = smoothstep(float(0), float(0.045), fractures.y.sub(fractures.x)).oneMinus().mul(0.6)
  const cracks = max(crackBroad, crackFine) // 0..1 bright vein network

  const mottle = mx_fractal_noise_float(mul(iceUv, 1.4), 3, 2.0, 0.5).mul(0.5).add(0.5)
  // Plate interior: milky blue → pale; cracks blow out toward white.
  const iceTint = mix(color('#9fbfd4'), color('#d6e7f0'), mottle)
  const iceCol = mix(iceTint, color('#f4fbff'), cracks)

  // Frosted but semi-opaque: plates ~0.6–0.9 (depth shows in the clearer ones),
  // cracks always near-solid so the network stays crisp.
  const iceOpacity = max(mix(float(0.6), float(0.9), mottle), cracks.mul(0.95))
  col = mix(col, iceCol, frozen)
  opacity = mix(opacity, iceOpacity, frozen)
  // Icy specular: drop roughness where frozen for a wet, glassy sheen vs the
  // matte liquid (0.9). Cracks stay slightly rougher (frosted edges).
  mat.roughnessNode = mix(float(0.9), mix(float(0.35), float(0.6), cracks), frozen)

  // Electric discharges from a single bolt sprite. Instead of layers that are always
  // on (which read as a static grid of arcs), each "strike" is dark, then flashes
  // instantly and fades over its cycle (exp decay) — and every cycle it picks a fresh
  // random angle + position, so it looks like a new arc each time, not one line
  // pulsing. Several strikes run on different clocks so they fire at unsynced times.
  // Luminance (.r; the sprite is greyscale) is the intensity, recoloured to a white-hot
  // core with a cyan halo and added as glow. Gated by charge; skipped until loaded.
  if (electricTex) {
    // ⬇️ Texture size knob: higher = smaller bolts (sprite repeats more), lower = bigger.
    const BOLT_SCALE = 5
    const TAU = Math.PI * 2
    // Cheap per-cycle hash (sin-fract) → a fresh random value each strike cycle.
    const hash = (n: ReturnType<typeof float>) => n.mul(12.9898).sin().mul(43758.5453).fract()

    // One strike: repeats every ~1/rate seconds. `decay` = fade snappiness (higher =
    // shorter flash). `seed` desyncs strikes and seeds the per-cycle randoms.
    const strike = (rate: number, seed: number, decay: number) => {
      const tt = time.mul(rate).add(seed)
      const cyc = tt.floor() // integer cycle index → constant within a flash
      const env = tt.fract().mul(-decay).exp() // 1 at strike instant → fades to ~0
      const ang = hash(cyc.add(seed)).mul(TAU) // random heading this cycle
      const ca = ang.cos()
      const sa = ang.sin()
      const p = fieldUv.sub(0.5)
      const rot = vec2(p.x.mul(ca).sub(p.y.mul(sa)), p.x.mul(sa).add(p.y.mul(ca)))
      const off = vec2(hash(cyc.add(seed).add(3.1)), hash(cyc.add(seed).add(8.7))) // random place
      const uvL = rot.mul(BOLT_SCALE).add(off)
      return textureNode(electricTex, uvL).r.mul(env)
    }

    // ⬇️ Each row is one strike: (firing rate, seed, fade snappiness). Add/remove rows
    // to change how many arcs can be live at once; vary rates so they stay unsynced.
    const bolts = max(
      strike(0.55, 0.0, 12),
      max(
        strike(0.43, 3.3, 14),
        max(
          strike(0.61, 7.1, 10),
          max(
            strike(0.37, 11.9, 13),
            strike(0.49, 17.5, 11),
          ),
        ),
      ),
    ).mul(electrified)
    // Halo tint follows the liquid: cyan over water, red over blood (kinds are
    // exclusive per cell, so bloodMask picks it). Core stays white-hot for both.
    const halo = mix(color('#2aa8ff'), color('#ff3346'), bloodMask)
    const boltCol = mix(halo, color('#fbfdff'), bolts)
    col = add(col, boltCol.mul(bolts.mul(2.4)))
    opacity = max(opacity, bolts.saturate().mul(0.95))
  }

  mat.colorNode = col
  mat.opacityNode = opacity
  return mat
}
