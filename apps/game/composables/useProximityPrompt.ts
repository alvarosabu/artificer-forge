import { MathUtils } from 'three'
import type { MaybeRefOrGetter } from 'vue'

export type PromptStage = 'hidden' | 'notice' | 'interact'

export interface ProximityPromptOptions {
  /** Feet position of the target. */
  position: MaybeRefOrGetter<[number, number, number]>
  /** Within this ground distance, in meters, the marker shows. */
  noticeRadius?: number
  /** Within this ground distance, in meters, the marker is ready to be interacted with. */
  interactRadius?: number
  /** The angle, in radians, at which the marker is facing the player. */
  facingAngle?: MaybeRefOrGetter<number>
}

// Once shown, the marker stays until the player is this far past the radius, so standing on the edge does not flicker it.
const EXIT_MARGIN = 0.5
const EXIT_ANGLE = 10

/** The prompt stage of one target, from the player's distance to it. */
export function useProximityPrompt(options: ProximityPromptOptions) {
    const player = usePlayer()
    const noticeRadius = options.noticeRadius ?? 6
    const interactRadius = options.interactRadius ?? 2.5
    const facingAngle = options.facingAngle ?? 60
    const enterCos = Math.cos(MathUtils.degToRad(toValue(facingAngle)))
    const exitCos = Math.cos(MathUtils.degToRad(toValue(facingAngle) + EXIT_ANGLE))
  
    const stage = computed<PromptStage>((previous) => {
      const [px, , pz] = player.position
      const [tx, , tz] = toValue(options.position)
      const dx = tx - px
      const dz = tz - pz
      const distance = Math.hypot(dx, dz)
  
      const wasInteract = previous === 'interact'
      if (distance <= (wasInteract ? interactRadius + EXIT_MARGIN : interactRadius)) {
        const yaw = player.yaw
        const facing = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / distance
        if (facing >= (wasInteract ? exitCos : enterCos)) return 'interact'
      }
  
      const shown = previous === 'notice' || wasInteract
      return distance <= (shown ? noticeRadius + EXIT_MARGIN : noticeRadius) ? 'notice' : 'hidden'
    })
  
    return { stage }
  }
  
  