import { useRapier } from '@tresjs/rapier'
import type { ExposedRigidBody } from '@tresjs/rapier'
import { Vector3 } from 'three'
import type { MaybeRefOrGetter } from 'vue'

// Change in velocity over one step, in m/s. A resting letter reads 0.15, a walk-speed kick 2, its bounces 0.5 to 1.5.
const MIN_IMPACT = 0.4
const LOUD_IMPACT = 3
const QUIET_IMPACT_LEVEL = -12
const COOLDOWN_SECONDS = 0.1
const SPLASH_SPEEDS = { quietImpact: 1, loudImpact: 4, quietImpactLevel: -4 }
const SPLASH_BOOST = 4
// A letter is heavier than Chamo, so it takes the big splash from a lower fall.
const BIG_SPLASH_SPEED = 3
// Letters fall in at the shore, metres from the player. The default falloff is tuned for the torches and loses 10 to 17 dB there.
const SPLASH_REF_DISTANCE = 6
const SPLASH_ROLLOFF = 1
// Waves wash over a letter resting at the shore. Only a letter that drops through the surface splashes.
const MIN_SPLASH_FALL = 0.5

interface BodyState {
  x: number
  y: number
  z: number
  /** Height above the water surface, or Infinity where there is no water. */
  aboveWater: number
  cooldown: number
}

/** Plays `sound` from each body when something hits it hard, and a splash when it drops into water. Call it inside `<Physics>` and an `<AudioController>`. */
export function useImpactSounds(
  bodies: MaybeRefOrGetter<(ExposedRigidBody | null | undefined)[] | null>,
  sound: SoundName,
  options: {
    waterAt?: (x: number, z: number) => number | null
    /** Called where a body drops through the water, with its fall speed and horizontal velocity. */
    onSplash?: (at: Vector3, fallSpeed: number, motion: Vector3, body: ExposedRigidBody) => void
  } = {},
) {
  const audio = useAudio()
  audio.load(sound, 'splash', 'splashBig')
  const { world, onBeforeStep } = useRapier()

  const states = new Map<number, BodyState>()
  const at = new Vector3()
  const motion = new Vector3()
  let lastStep = 0

  function heightAboveWater(x: number, y: number, z: number) {
    const level = options.waterAt?.(x, z)
    return level === null || level === undefined ? Infinity : y - level
  }

  // Not contact-force events: @tresjs/rapier drops them against colliders with no scene object, like our ground.
  const stop = onBeforeStep((step) => {
    const gravity = world.value.gravity
    for (const exposed of toValue(bodies) ?? []) {
      const body = exposed?.instance
      if (!body) continue
      const velocity = body.linvel()
      const { x, y, z } = body.translation()
      const aboveWater = heightAboveWater(x, y, z)
      const state = states.get(body.handle)
      if (!state) {
        states.set(body.handle, { ...velocity, aboveWater, cooldown: 0 })
        continue
      }
      state.cooldown -= step

      if (state.aboveWater >= 0 && aboveWater < 0 && velocity.y < -MIN_SPLASH_FALL) {
        const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
        audio.play(speed >= BIG_SPLASH_SPEED ? 'splashBig' : 'splash', {
          volume: SPLASH_BOOST + impactLevel({ impactSpeed: speed, ...SPLASH_SPEEDS }),
          position: at.set(x, y - aboveWater, z),
          refDistance: SPLASH_REF_DISTANCE,
          rolloff: SPLASH_ROLLOFF,
        })
        options.onSplash?.(at, -velocity.y, motion.set(velocity.x, 0, velocity.z), exposed)
      }
      // Knocks on the sea floor would be muffled, and right after the splash they only muddy it.
      else if (aboveWater >= 0 && !body.isSleeping()) {
        // Gravity alone changes the velocity by g·dt every step. Take it out, or every fall is a hit.
        const fall = body.gravityScale() * lastStep
        const impact = Math.hypot(
          velocity.x - state.x - gravity.x * fall,
          velocity.y - state.y - gravity.y * fall,
          velocity.z - state.z - gravity.z * fall,
        )
        if (impact >= MIN_IMPACT && state.cooldown <= 0) {
          state.cooldown = COOLDOWN_SECONDS
          audio.play(sound, {
            volume: impactLevel({ impactSpeed: impact, quietImpact: MIN_IMPACT, loudImpact: LOUD_IMPACT, quietImpactLevel: QUIET_IMPACT_LEVEL }),
            position: at.set(x, y, z),
          })
        }
      }
      state.x = velocity.x
      state.y = velocity.y
      state.z = velocity.z
      state.aboveWater = aboveWater
    }
    lastStep = step
  })
  onScopeDispose(stop)
}
