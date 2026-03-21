import type { ComputedRef } from 'vue'
import type { Object3D } from 'three'
import { createEmberSystem, heatColor, EMBER_COUNT, MAX_RADIUS, RESET_Y } from '@artificer-forge/vfx'
import type { StatusEffectId } from '~/stores/game'

export function useStatusEffectParticles(
  rig: ComputedRef<Object3D | null | undefined>,
  entityId: ComputedRef<string>,
) {
  const gameStore = useGameStore()

  let system: ReturnType<typeof createEmberSystem> | null = null
  let elapsed = 0

  function attach() {
    if (!rig.value || system) return
    system = createEmberSystem()
    rig.value.add(system.points)
  }

  function detach() {
    if (!system) return
    rig.value?.remove(system.points)
    system.geometry.dispose()
    system.points.material.dispose()
    system = null
    elapsed = 0
  }

  const { onBeforeRender } = useLoop()

  onBeforeRender(({ delta }) => {
    if (!system) return
    elapsed += delta
    const { positions, meta } = system

    for (let i = 0; i < EMBER_COUNT; i++) {
      const m = meta[i]

      // Rise
      positions[i * 3 + 1] += m.speed * delta

      // Reset when particle escapes above character
      if (positions[i * 3 + 1] > RESET_Y) {
        m.angle             = Math.random() * Math.PI * 2
        m.radius            = 0.12 + Math.random() * (MAX_RADIUS - 0.12)
        positions[i * 3 + 1] = m.initialY

        // Re-randomise heat color on reset for flickering variety
        const [r, g, b] = heatColor(Math.random())
        system.colors[i * 3 + 0] = r
        system.colors[i * 3 + 1] = g
        system.colors[i * 3 + 2] = b
      }

      // Lateral wobble in cylindrical coords
      const wobbleR = m.radius + Math.sin(elapsed * m.wobbleFreq + m.wobblePhase) * 0.05
      positions[i * 3 + 0] = Math.cos(m.angle + elapsed * 0.3) * wobbleR
      positions[i * 3 + 2] = Math.sin(m.angle + elapsed * 0.3) * wobbleR
    }

    system.geometry.attributes.position.needsUpdate = true
    system.geometry.attributes.color.needsUpdate    = true
  })

  watch(
    () => gameStore.getEntity(entityId.value)?.statusEffects,
    (effects) => {
      const isBurning = effects?.some((se: { id: StatusEffectId }) => se.id === 'burning') ?? false
      if (isBurning) attach()
      else detach()
    },
    { deep: true },
  )

  // Re-attach if rig becomes available while burning is active
  watch(rig, (newRig) => {
    if (newRig && system) newRig.add(system.points)
  })

  onScopeDispose(detach)
}
