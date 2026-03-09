import type { ComputedRef } from 'vue'
import type { Object3D } from 'three'
import { Points, PointsMaterial, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three'
import type { StatusEffectId } from '~/stores/game'

const EMBER_COUNT = 60
const CHAR_HEIGHT  = 2.2
const MAX_RADIUS   = 0.55
const RESET_Y      = CHAR_HEIGHT + 0.4  // despawn height

interface EmberMeta {
  angle:       number   // cylindrical angle (updated on reset for variety)
  radius:      number   // distance from character axis
  initialY:    number   // spawn height offset
  speed:       number   // rise speed (units/s)
  wobblePhase: number   // lateral sway phase
  wobbleFreq:  number   // lateral sway frequency
}

// Lerp between two RGB triples
function lerpRgb(
  r0: number, g0: number, b0: number,
  r1: number, g1: number, b1: number,
  t: number,
): [number, number, number] {
  return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t]
}

function heatColor(heat: number): [number, number, number] {
  // 0 = deep red  →  0.5 = orange  →  1 = yellow
  const red    = [0.73, 0.07, 0.0] as const
  const orange = [1.0,  0.33, 0.0] as const
  const yellow = [1.0,  0.93, 0.27] as const
  if (heat < 0.5) return lerpRgb(...red, ...orange, heat * 2)
  return lerpRgb(...orange, ...yellow, (heat - 0.5) * 2)
}

function createEmberSystem() {
  const positions = new Float32Array(EMBER_COUNT * 3)
  const colors    = new Float32Array(EMBER_COUNT * 3)
  const meta: EmberMeta[] = []

  for (let i = 0; i < EMBER_COUNT; i++) {
    const angle  = Math.random() * Math.PI * 2
    const radius = 0.12 + Math.random() * (MAX_RADIUS - 0.12)
    const y      = Math.random() * CHAR_HEIGHT  // stagger initial heights

    positions[i * 3 + 0] = Math.cos(angle) * radius
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(angle) * radius

    const [r, g, b] = heatColor(Math.random())
    colors[i * 3 + 0] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b

    meta.push({
      angle,
      radius,
      initialY:    Math.random() * 0.2,
      speed:       0.5 + Math.random() * 1.0,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq:  1.2 + Math.random() * 2.5,
    })
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color',    new BufferAttribute(colors,    3))

  const material = new PointsMaterial({
    size:            0.05,
    sizeAttenuation: true,
    vertexColors:    true,
    transparent:     true,
    depthWrite:      false,
    blending:        AdditiveBlending,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false

  return { points, geometry, positions, colors, meta }
}

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
