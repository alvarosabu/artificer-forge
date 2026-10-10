import { useControls } from '@tresjs/leches'
import { createSplashDroplets } from '@artificer-forge/vfx'
import { Group, MathUtils, Vector3 } from 'three'
import type { Color, Node } from 'three/webgpu'
import { stylizedOutput } from '@artificer-forge/engine/runtime'

// The fall speed that gives a burst of strength 1.
const FULL_SPLASH_IMPACT = 8
const DROPLETS_PER_BURST = 18

export function useSplash() {
  const uuid = inject<string>('uuid')
  const grading = useGrading()
  const shade = (color: Node<'color'>, normal: Node<'vec3'>) =>
    stylizedOutput(color, grading, { normalNode: normal, hasRim: true })
  const droplets = createSplashDroplets({ shade })

  const object = new Group()
  object.add(droplets.mesh)

  const { splashLift, splashSpread, splashGravity } = useControls('💦 splash', {
    lift: { value: 4.2, min: 0.5, max: 10, step: 0.1, type: 'range' },
    spread: { value: 1.6, min: 0, max: 5, step: 0.05, type: 'range' },
    gravity: { value: droplets.uniforms.gravity.value, min: 2, max: 40, step: 0.5, type: 'range' },
  }, { uuid })
  watch(splashGravity!, (v) => { droplets.uniforms.gravity.value = v })

  const { onBeforeRender } = useLoop()
  onBeforeRender(({ elapsed }) => droplets.update(elapsed))
  onUnmounted(() => droplets.dispose())

  const spawnPoint = new Vector3()
  const velocity = new Vector3()

  function burst(at: Vector3, impactSpeed: number) {
    const strength = MathUtils.clamp(impactSpeed / FULL_SPLASH_IMPACT, 0.3, 1.5)
    const lift = splashLift?.value ?? 4.2
    const spread = splashSpread?.value ?? 1.6
    for (let i = 0; i < DROPLETS_PER_BURST; i++) {
      const angle = (i / DROPLETS_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dx = Math.cos(angle)
      const dz = Math.sin(angle)
      // One random value for height and reach: tall droplets stay close, so the burst opens like a cone.
      const r = Math.random()
      const up = lift * strength * (0.6 + 0.7 * r)
      const out = spread * strength * (1.2 - 0.8 * r)
      spawnPoint.set(at.x + dx * 0.25, at.y + 0.05, at.z + dz * 0.25)
      velocity.set(dx * out, up, dz * out)
      droplets.emit(spawnPoint, velocity, 0.06 + Math.random() * 0.08 * strength)
    }
  }

  return { object, burst }
}