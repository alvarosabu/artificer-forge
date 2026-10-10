import { useControls } from '@tresjs/leches'
import { createSplashCrowns, createSplashDroplets, createSplashRipples } from '@artificer-forge/vfx'
import { Group, MathUtils, Vector3 } from 'three'
import type { Color, Node } from 'three/webgpu'
import { stylizedOutput } from '@artificer-forge/engine/runtime'

// The fall speed that gives a burst of strength 1.
const FULL_SPLASH_IMPACT = 8
const DROPLETS_PER_BURST = 18
const SURFACE_LIFT = 0.02


export function useSplash() {
  const uuid = inject<string>('uuid')
  const grading = useGrading()
  const shade = (color: Node<'color'>, normal: Node<'vec3'>) =>
    stylizedOutput(color, grading, { normalNode: normal, hasRim: true })
  const droplets = createSplashDroplets({ shade })
  // One burst fills 21 slots: a landing ring per droplet plus three entry rings.
  const ripples = createSplashRipples({ count: 64, shade: color =>stylizedOutput(color, grading, { hasCoreShadows: false }) })
  const crowns = createSplashCrowns({ shade })

  const object = new Group()
  object.add(droplets.mesh, ripples.mesh, crowns.mesh)

  const { splashLift, splashSpread, splashCarry, splashCarryMax, splashCarryBias, splashGravity } = useControls('💦 splash', {
    lift: { value: 4.2, min: 0.5, max: 10, step: 0.1, type: 'range' },
    spread: { value: 1.6, min: 0, max: 5, step: 0.05, type: 'range' },
    carry: { value: 0.15, min: 0, max: 1, step: 0.01, type: 'range' },
    carryMax: { value: 1, min: 0, max: 5, step: 0.05, type: 'range' },
    carryBias: { value: 0.6, min: 0, max: 1, step: 0.05, type: 'range' },
    gravity: { value: droplets.uniforms.gravity.value, min: 2, max: 40, step: 0.5, type: 'range' },
  }, { uuid })
  watch(splashGravity!, (v) => { droplets.uniforms.gravity.value = v })

  const { onBeforeRender } = useLoop()
  onBeforeRender(({ elapsed }) => {
    droplets.update(elapsed)
    ripples.update(elapsed)
    crowns.update(elapsed)
  })
  onUnmounted(() => {
    droplets.dispose()
    ripples.dispose()
    crowns.dispose()
  })

  const spawnPoint = new Vector3()
  const velocity = new Vector3()
  const surface = new Vector3()

  /** `motion` is the body's horizontal velocity at impact. Part of it carries into the droplets, so an angled dive throws water forward. */
  function burst(at: Vector3, impactSpeed: number, motion?: Vector3) {
    const strength = MathUtils.clamp(impactSpeed / FULL_SPLASH_IMPACT, 0.3, 1.5)
    const lift = splashLift?.value ?? 4.2
    const spread = splashSpread?.value ?? 1.6
    const motionSpeed = motion ? Math.hypot(motion.x, motion.z) : 0
    const aheadX = motionSpeed > 1e-3 ? motion!.x / motionSpeed : 0
    const aheadZ = motionSpeed > 1e-3 ? motion!.z / motionSpeed : 0
    const carrySpeed = Math.min(motionSpeed * (splashCarry?.value ?? 0.15), splashCarryMax?.value ?? 1)
    const carryBias = splashCarryBias?.value ?? 0.6
    for (let i = 0; i < DROPLETS_PER_BURST; i++) {
      const angle = (i / DROPLETS_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dx = Math.cos(angle)
      const dz = Math.sin(angle)
      // One random value for height and reach: tall droplets stay close, so the burst opens like a cone.
      const r = Math.random()
      const up = lift * strength * (0.6 + 0.7 * r)
      const out = spread * strength * (1.2 - 0.8 * r)
      spawnPoint.set(at.x + dx * 0.25, at.y + 0.05, at.z + dz * 0.25)
      // With bias, droplets thrown backward keep their speed and only the forward ones get the push.
      const push = carrySpeed * MathUtils.lerp(1, Math.max(0, dx * aheadX + dz * aheadZ), carryBias)
      velocity.set(dx * out + aheadX * push, up, dz * out + aheadZ * push)
      droplets.emit(spawnPoint, velocity, 0.06 + Math.random() * 0.08 * strength)

      // The shader kills the droplet when it falls back to its spawn height, so the ring waits for that moment.
      const tLand = (2 * up) / droplets.uniforms.gravity.value
      surface.set(spawnPoint.x + velocity.x * tLand, at.y + SURFACE_LIFT, spawnPoint.z + velocity.z * tLand)
      ripples.emit(surface, 0.2 + 0.1 * Math.random(), tLand)
    }

    surface.set(at.x, at.y + SURFACE_LIFT, at.z)
    ripples.emit(surface, 1.4 * strength)
    ripples.emit(surface, 0.9 * strength, 0.18)
    ripples.emit(surface, 0.4 * strength, 0.36)

    crowns.emit(surface, 0.3 + 0.15 * strength, 0.9 * strength, droplets.uniforms.gravity.value)


  }

  return { object, burst }
}