import { MathUtils } from 'three'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue'

export type PromptStage = 'hidden' | 'notice' | 'interact'

export interface ProximityPromptOptions {
  /** Feet position of the target. */
  position: MaybeRefOrGetter<[number, number, number]>
  /** Within this ground distance, in meters, the marker shows. */
  noticeRadius?: number
  /** Within this ground distance, in meters, and facing the target, the player can interact. */
  interactRadius?: number
  /** Half the width of the facing cone, in degrees. */
  facingAngle?: MaybeRefOrGetter<number>
  /** Runs when the player presses the interact button while this target's badge shows. */
  onInteract?: () => void
}

interface PromptTarget {
  /** The stage from distance and facing alone, before the registry picks one target. */
  reach: ComputedRef<PromptStage>
  distance: ComputedRef<number>
  presses: Ref<number>
  onInteract?: () => void
}

// Once shown, the marker stays until the player is this far past the radius, so standing on the edge does not flicker it.
const EXIT_MARGIN = 0.5
// The same idea for the facing cone, in degrees.
const EXIT_ANGLE = 10

function createPromptRegistry() {
  const targets = shallowReactive(new Set<PromptTarget>())

  /** The nearest target in reach to interact. Only this one shows the badge and takes the press. */
  const active = computed(() => {
    let nearest: PromptTarget | null = null
    for (const target of targets) {
      if (target.reach.value !== 'interact') continue
      if (!nearest || target.distance.value < nearest.distance.value) nearest = target
    }
    return nearest
  })

  function interact() {
    const target = active.value
    if (!target) return
    target.presses.value++
    target.onInteract?.()
  }

  return { targets, active, interact }
}

type PromptRegistry = ReturnType<typeof createPromptRegistry>

const PromptRegistryKey: InjectionKey<PromptRegistry> = Symbol('proximity-prompts')

export function provideProximityPrompts() {
  const registry = createPromptRegistry()
  provide(PromptRegistryKey, registry)
  return registry
}

/** The registry of every prompt in the page. Chamo calls `interact()` on the interact button. */
export function useProximityPrompts() {
  const registry = inject(PromptRegistryKey, null)
  if (!registry) throw new Error('useProximityPrompts() needs provideProximityPrompts() in the page')
  return registry
}

/** The prompt stage of one target, from the player's distance to it and the way the player faces. */
export function useProximityPrompt(options: ProximityPromptOptions) {
  const registry = useProximityPrompts()
  const player = usePlayer()
  const noticeRadius = options.noticeRadius ?? 6
  const interactRadius = options.interactRadius ?? 2.5
  const facingAngle = () => toValue(options.facingAngle) ?? 60
  const enterCos = computed(() => Math.cos(MathUtils.degToRad(facingAngle())))
  const exitCos = computed(() => Math.cos(MathUtils.degToRad(facingAngle() + EXIT_ANGLE)))

  const offset = computed(() => {
    const [px, , pz] = player.position
    const [tx, , tz] = toValue(options.position)
    return { dx: tx - px, dz: tz - pz }
  })
  const distance = computed(() => Math.hypot(offset.value.dx, offset.value.dz))

  const reach = computed<PromptStage>((previous) => {
    const { dx, dz } = offset.value
    const wasInteract = previous === 'interact'
    if (distance.value <= (wasInteract ? interactRadius + EXIT_MARGIN : interactRadius)) {
      const yaw = player.yaw
      const facing = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / distance.value
      if (facing >= (wasInteract ? exitCos.value : enterCos.value)) return 'interact'
    }

    const shown = previous === 'notice' || wasInteract
    return distance.value <= (shown ? noticeRadius + EXIT_MARGIN : noticeRadius) ? 'notice' : 'hidden'
  })

  const target: PromptTarget = { reach, distance, presses: ref(0), onInteract: options.onInteract }
  registry.targets.add(target)
  onScopeDispose(() => registry.targets.delete(target))

  // A target in reach that lost to a nearer one keeps its marker.
  const stage = computed<PromptStage>(() =>
    reach.value === 'interact' && registry.active.value !== target ? 'notice' : reach.value,
  )

  return { stage, presses: readonly(target.presses) }
}
