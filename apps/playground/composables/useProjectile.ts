import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  SphereGeometry,
  type Vector3,
} from 'three'
import { useLoop, useTres } from '@tresjs/core'

export interface ProjectileConfig {
  from: Vector3
  to: Vector3
  speed: number
  arc: 'distance-based' | 'straight' | 'parabolic'
  model?: Group
  visual?: 'orb'
  color?: string
}

export function useProjectile() {
  const { scene } = useTres()
  const { onBeforeRender } = useLoop()

  function spawnProjectile(config: ProjectileConfig): Promise<void> {
    const { from, to, speed, arc } = config

    const projectileGroup = new Group()
    projectileGroup.position.copy(from)
    scene.value.add(projectileGroup)

    // Create visual
    if (config.model) {
      projectileGroup.add(config.model.clone())
    }
    else if (config.visual === 'orb') {
      const color = config.color ?? '#ffffff'
      const sphere = new Mesh(
        new SphereGeometry(0.15, 16, 16),
        new MeshBasicMaterial({ color }),
      )
      const light = new PointLight(color, 1, 3)
      projectileGroup.add(sphere, light)
    }

    const distance = from.distanceTo(to)
    const duration = distance / speed
    let elapsed = 0
    let done = false

    // Arc height for distance-based trajectory
    const arcHeight = arc === 'straight'
      ? 0
      : Math.min(3.0, Math.max(0.3, distance * 0.15))

    return new Promise<void>((resolve) => {
      const { off } = onBeforeRender(({ delta }) => {
        if (done) return

        elapsed += delta
        const tLinear = Math.min(elapsed / duration, 1)
        // Ease-in-out: fast launch, slow at peak, accelerate down
        const t = tLinear < 0.5
          ? 4 * tLinear * tLinear * tLinear
          : 1 - Math.pow(-2 * tLinear + 2, 3) / 2

        // Position: lerp + arc
        const x = from.x + (to.x - from.x) * t
        const z = from.z + (to.z - from.z) * t
        // Parabolic arc: 4h*t*(1-t) peaks at t=0.5
        const yArc = arcHeight * 4 * t * (1 - t)
        const y = from.y + (to.y - from.y) * t + yArc

        projectileGroup.position.set(x, y, z)

        // Rotate to face direction of travel (tangent)
        if (config.model) {
          const nextT = Math.min(t + 0.01, 1)
          const nx = from.x + (to.x - from.x) * nextT
          const nz = from.z + (to.z - from.z) * nextT
          const nyArc = arcHeight * 4 * nextT * (1 - nextT)
          const ny = from.y + (to.y - from.y) * nextT + nyArc
          projectileGroup.lookAt(nx, ny, nz)
          // Arrow model points along +X, lookAt aligns -Z → yaw 90° to match
          projectileGroup.rotateY(Math.PI / 2)
        }

        if (tLinear >= 1) {
          done = true
          off()
          scene.value.remove(projectileGroup)
          projectileGroup.traverse((child) => {
            if ((child as Mesh).isMesh) {
              const mesh = child as Mesh
              mesh.geometry?.dispose()
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose())
              }
              else {
                mesh.material?.dispose()
              }
            }
          })
          resolve()
        }
      })
    })
  }

  return { spawnProjectile }
}
