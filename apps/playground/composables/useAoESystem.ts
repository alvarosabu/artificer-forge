import { createSharedComposable } from '@vueuse/core'
import { entitiesInCircle, entitiesInCone, entitiesInLine } from '@artificer-forge/engine/core'
import {
  Vector3,
  Mesh,
  CircleGeometry,
  PlaneGeometry,
  ShapeGeometry,
  Shape,
  MeshBasicMaterial,
  type Scene,
} from 'three'

export type AoEShape = 'circle' | 'cone' | 'line'

export interface AoEConfig {
  shape: AoEShape
  radius?: number
  width?: number
  angle?: number
  color?: string
  range: number
}

function createShapeMesh(config: AoEConfig): Mesh {
  const color = config.color ?? '#ff4444'
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  })

  let geometry
  switch (config.shape) {
    case 'circle':
      geometry = new CircleGeometry(config.radius ?? 4, 32)
      break
    case 'line':
      geometry = new PlaneGeometry(config.width ?? 1, config.radius ?? 10)
      break
    case 'cone': {
      const length = config.radius ?? 6
      const halfAngle = ((config.angle ?? 60) / 2) * (Math.PI / 180)
      const shape = new Shape()
      shape.moveTo(0, 0)
      const segments = 16
      for (let i = 0; i <= segments; i++) {
        const a = -halfAngle + (2 * halfAngle * i) / segments
        shape.lineTo(Math.sin(a) * length, Math.cos(a) * length)
      }
      shape.lineTo(0, 0)
      geometry = new ShapeGeometry(shape)
      break
    }
  }

  const mesh = new Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.01
  return mesh
}

export const useAoESystem = createSharedComposable(() => {
  const gameStore = useGameStore()

  const isActive = ref(false)
  const currentConfig = ref<AoEConfig | null>(null)
  const previewMesh = shallowRef<Mesh | null>(null)
  const previewPosition = ref(new Vector3())
  const rotation = ref(0)
  const casterPosition = ref(new Vector3())
  const sceneRef = shallowRef<Scene | null>(null)

  let pulseElapsed = 0

  function startPreview(scene: Scene, casterPos: Vector3, config: AoEConfig) {
    cancelPreview()
    sceneRef.value = scene
    casterPosition.value.copy(casterPos)
    currentConfig.value = config
    isActive.value = true
    rotation.value = 0
    pulseElapsed = 0

    const mesh = createShapeMesh(config)
    previewMesh.value = mesh
    scene.add(mesh)
  }

  function updatePreview(cursorPoint: Vector3, delta: number) {
    if (!previewMesh.value || !currentConfig.value) return

    const config = currentConfig.value

    const dist = casterPosition.value.distanceTo(
      new Vector3(cursorPoint.x, 0, cursorPoint.z),
    )
    const outOfRange = dist > config.range
    const mat = previewMesh.value.material as MeshBasicMaterial

    pulseElapsed += delta
    const baseOpacity = outOfRange ? 0.15 : 0.25
    mat.opacity = baseOpacity + Math.sin(pulseElapsed * 4) * 0.1
    if (outOfRange) mat.color.set('#ff0000')
    else mat.color.set(config.color ?? '#ff4444')

    if (config.shape === 'circle') {
      previewMesh.value.position.set(cursorPoint.x, 0.01, cursorPoint.z)
      previewPosition.value.copy(cursorPoint)
    }
    else {
      previewMesh.value.position.set(
        casterPosition.value.x,
        0.01,
        casterPosition.value.z,
      )
      const angle = Math.atan2(
        cursorPoint.x - casterPosition.value.x,
        cursorPoint.z - casterPosition.value.z,
      )
      previewMesh.value.rotation.set(-Math.PI / 2, 0, -(angle + rotation.value))
      previewPosition.value.copy(cursorPoint)
    }
  }

  function rotatePreview(amount: number) {
    rotation.value += amount
  }

  function confirm(): string[] {
    if (!currentConfig.value) return []

    const config = currentConfig.value
    const entities = gameStore.entities as unknown as Map<string, { position: { x: number, z: number } }>

    let ids: string[] = []
    if (config.shape === 'circle') {
      ids = entitiesInCircle(previewPosition.value, config.radius ?? 4, entities)
    }
    else if (config.shape === 'cone') {
      const dir = new Vector3()
        .subVectors(previewPosition.value, casterPosition.value)
        .normalize()
      ids = entitiesInCone(
        casterPosition.value,
        dir,
        config.radius ?? 6,
        (config.angle ?? 60) / 2,
        entities,
      )
    }
    else if (config.shape === 'line') {
      ids = entitiesInLine(
        casterPosition.value,
        previewPosition.value,
        (config.width ?? 1) / 2,
        entities,
      )
    }

    cancelPreview()
    return ids
  }

  function cancelPreview() {
    if (previewMesh.value && sceneRef.value) {
      sceneRef.value.remove(previewMesh.value)
      const mat = previewMesh.value.material as MeshBasicMaterial
      previewMesh.value.geometry.dispose()
      mat.dispose()
    }
    previewMesh.value = null
    currentConfig.value = null
    isActive.value = false
  }

  return {
    isActive: readonly(isActive),
    startPreview,
    updatePreview,
    rotatePreview,
    confirm,
    cancelPreview,
  }
})
