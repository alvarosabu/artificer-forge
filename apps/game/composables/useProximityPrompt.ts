import { MathUtils } from 'three'
import type { Vector3Tuple } from 'three'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue'

export type PromptStage = 'hidden' | 'notice' | 'interact'

/** The Entity action names a prompt badge can show. */
export type PromptAction = 'Examine' | 'Talk' | 'Attack' | 'Loot' | 'Pick Up'

export interface ProximityPromptOptions {
  /** Feet position of the thing the prompt floats above. */
  position: MaybeRefOrGetter<Vector3Tuple>
  /** Within this ground distance, in meters, the marker shows. */
  noticeRadius?: number
  /** Within this ground distance, in meters, and facing the prompt, the player can interact. */
  interactRadius?: number
  /** Half the width of the facing cone, in degrees. */
  facingAngle?: number
  /** Runs when the player presses the interact button while this prompt's badge shows. */
  onInteract?: () => void
}

interface PromptEntry {
  // The stage from distance and facing alone, before the registry picks one prompt.
  reach: ComputedRef<PromptStage>
  distance: ComputedRef<number>
  presses: Ref<number>
  onInteract?: () => void
}

// Once shown, a stage stays until the player is this much past its limit, so standing on the edge does not flicker it.
const EXIT_MARGIN = 0.5
const EXIT_ANGLE = 10

const hysteresis = (limit: number, margin: number, shown: boolean) => shown ? limit + margin : limit

function createPromptRegistry() {
  const prompts = shallowReactive(new Set<PromptEntry>())

  // Only the nearest prompt in interact reach shows the badge and takes the press.
  const active = computed(() => {
    let nearest: PromptEntry | null = null
    for (const prompt of prompts) {
      if (prompt.reach.value !== 'interact') continue
      if (!nearest || prompt.distance.value < nearest.distance.value) nearest = prompt
    }
    return nearest
  })

  function interact() {
    const prompt = active.value
    if (!prompt) return
    prompt.presses.value++
    prompt.onInteract?.()
  }

  return { prompts, active, interact }
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

/** The stage of one prompt, from the player's distance to it and the way the player faces. */
export function useProximityPrompt(options: ProximityPromptOptions) {
  const registry = useProximityPrompts()
  const player = usePlayer()
  const noticeRadius = options.noticeRadius ?? 6
  const interactRadius = options.interactRadius ?? 2.5
  const facingAngle = options.facingAngle ?? 60

  const offset = computed(() => {
    const [px, , pz] = player.position
    const [x, , z] = toValue(options.position)
    return { dx: x - px, dz: z - pz }
  })
  const distance = computed(() => Math.hypot(offset.value.dx, offset.value.dz))

  const reach = computed<PromptStage>((previous) => {
    const { dx, dz } = offset.value
    const wasInteract = previous === 'interact'
    if (distance.value <= hysteresis(interactRadius, EXIT_MARGIN, wasInteract)) {
      const yaw = player.yaw
      const facing = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / distance.value
      const cone = MathUtils.degToRad(hysteresis(facingAngle, EXIT_ANGLE, wasInteract))
      if (facing >= Math.cos(cone)) return 'interact'
    }

    const shown = previous === 'notice' || wasInteract
    return distance.value <= hysteresis(noticeRadius, EXIT_MARGIN, shown) ? 'notice' : 'hidden'
  })

  const entry: PromptEntry = { reach, distance, presses: ref(0), onInteract: options.onInteract }
  registry.prompts.add(entry)
  onScopeDispose(() => registry.prompts.delete(entry))

  // A prompt in interact reach that lost to a nearer one keeps its marker.
  const stage = computed<PromptStage>(() =>
    reach.value === 'interact' && registry.active.value !== entry ? 'notice' : reach.value,
  )

  return { stage, presses: readonly(entry.presses) }
}
