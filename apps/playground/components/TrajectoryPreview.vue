<script setup lang="ts">
import {
  Vector3,
  CatmullRomCurve3,
  TubeGeometry,
  MeshStandardMaterial,
  Mesh,
} from 'three'
import { useTres, useLoop } from '@tresjs/core'

const props = defineProps<{
  from: Vector3
  to: Vector3
  arc: 'distance-based' | 'straight' | 'parabolic'
  color?: string
  segments?: number
}>()

const { scene } = useTres()

const SEGMENTS = computed(() => props.segments ?? 32)
const TUBE_RADIUS = 0.02

const tube = shallowRef<Mesh | null>(null)

function buildArc() {
  if (tube.value) {
    scene.value.remove(tube.value)
    tube.value.geometry.dispose()
    ;(tube.value.material as MeshStandardMaterial).dispose()
  }

  const from = props.from
  const to = props.to
  const distance = from.distanceTo(to)
  if (distance < 0.1) return

  const arcHeight = props.arc === 'straight'
    ? 0
    : Math.min(3.0, Math.max(0.3, distance * 0.15))

  const points: Vector3[] = []
  for (let i = 0; i <= SEGMENTS.value; i++) {
    const t = i / SEGMENTS.value
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    const yArc = arcHeight * 4 * t * (1 - t)
    const y = from.y + (to.y - from.y) * t + yArc
    points.push(new Vector3(x, y, z))
  }

  const curve = new CatmullRomCurve3(points)
  const geometry = new TubeGeometry(curve, SEGMENTS.value, TUBE_RADIUS, 6, false)
  const c = props.color ?? '#ffffff'
  const material = new MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.6,
  })

  const mesh = new Mesh(geometry, material)
  scene.value.add(mesh)
  tube.value = mesh
}

watch(
  () => [props.from, props.to, props.arc, props.color],
  () => buildArc(),
  { deep: true },
)

const { onBeforeRender } = useLoop()
let elapsed = 0
onBeforeRender(({ delta }) => {
  if (!tube.value) return
  elapsed += delta
  const mat = tube.value.material as MeshStandardMaterial
  mat.opacity = 0.5 + Math.sin(elapsed * 4) * 0.2
})

onMounted(() => buildArc())

onUnmounted(() => {
  if (tube.value) {
    scene.value.remove(tube.value)
    tube.value.geometry.dispose()
    ;(tube.value.material as MeshStandardMaterial).dispose()
    tube.value = null
  }
})
</script>

<template>
  <slot />
</template>
