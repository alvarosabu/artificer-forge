<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { MathUtils, Vector2, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'

// Fixed-angle follow camera, modelled on Bruno Simon's Folio 2025 View.js:
// the angle never changes, zoom only moves along the view ray, dragging pans the
// focus point and a magnet pulls it back to the tracked target.
const props = withDefaults(defineProps<{
  target?: [number, number, number]
}>(), {
  target: () => [0, 0, 0],
})

const uuid = inject<string>('uuid')

// Angles are degrees in the panel. Bruno's defaults are phi 0.27π (48.6°) and theta 0.25π; phi is 70 here (polar angle from +Y, so a lower, more side-on view).
const {
  cameraFree,
  cameraFov,
  cameraNear,
  cameraFar,
  cameraPhi,
  cameraTheta,
  cameraRadiusMin,
  cameraRadiusMax,
  cameraZoom,
  cameraZoomSensitivity,
  cameraEasing,
  cameraPan,
  cameraMagnet,
  cameraFraming,
} = useControls('🎥 camera', {
  free: { value: true, type: 'boolean' },
  fov: { value: 25, min: 10, max: 120, step: 1, type: 'range' },
  near: { value: 0.1, min: 0.01, max: 10, step: 0.01, type: 'range' },
  far: { value: 200, min: 10, max: 3000, step: 10, type: 'range' },
  phi: { value: 70, min: 1, max: 90, step: 0.1, type: 'range' },
  theta: { value: 22, min: -180, max: 180, step: 0.5, type: 'range' },
  radiusMin: { value: 15, min: 1, max: 100, step: 0.5, type: 'range' },
  radiusMax: { value: 30, min: 1, max: 200, step: 0.5, type: 'range' },
  zoom: { value: 0, min: 0, max: 1, step: 0.01, type: 'range' },
  zoomSensitivity: { value: 0.05, min: 0, max: 0.5, step: 0.005, type: 'range' },
  easing: { value: 10, min: 0.5, max: 30, step: 0.5, type: 'range' },
  pan: { value: true, type: 'boolean' },
  magnet: { value: 0.25, min: 0, max: 1, step: 0.01, type: 'range' },
  // Player height on screen, from the bottom: 0.5 is the center, 0.33 the lower third
  framing: { value: 0.33, min: 0.1, max: 0.9, step: 0.01, type: 'range' },
}, { uuid })

// Bruno adds radius when the viewport is narrower than 16:9 so the framing keeps its width.
const IDEAL_RATIO = 16 / 9
const NON_IDEAL_RATIO_OFFSET = 9

const tracked = new Vector3()
const focus = new Vector3(...props.target)
const smoothFocus = focus.clone()
const offset = new Vector3()
const pan = new Vector2()
const origin = new Vector2()
let isTracking = true

// Free mode orbits the player. OrbitControls owns the angle and distance, and the
// camera moves by the player's step so they stay in the middle.
const orbitTarget = ref<[number, number, number]>([...props.target])
const step = new Vector3()
// False until the follow pose has placed the camera once. Without it, free mode
// starts at the camera's default spot, looking at the origin.
let freePlaced = false

// The wheel writes here; moving the panel slider overrides it.
const zoomRatio = ref(cameraZoom?.value ?? 0.6)
watch(() => cameraZoom?.value, (value) => { if (value !== undefined) zoomRatio.value = value })
let smoothZoom = zoomRatio.value

// A new target means the player moved: follow them again, like Bruno's resume on drive input.
watch(() => props.target, () => { isTracking = true }, { deep: true })

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, camera }) => {
  const cam = toValue(camera) as PerspectiveCamera | undefined
  if (!cam) return

  // Shifts the projection window, not the camera, so the angle, the zoom and the
  // free-mode orbit stay the same. Sizes are in screen heights, so they do not depend
  // on the canvas pixels. setViewOffset overwrites aspect with fullWidth / fullHeight,
  // so fullWidth must be the current aspect or the image stretches.
  const framingOffset = (cameraFraming?.value ?? 0.33) - 0.5
  if (cam.view?.offsetY !== framingOffset || cam.view.fullWidth !== cam.aspect) {
    cam.setViewOffset(cam.aspect, 1, 0, framingOffset, cam.aspect, 1)
  }

  tracked.set(...props.target)
  if (cameraFree?.value && freePlaced) {
    step.subVectors(tracked, smoothFocus)
    if (step.lengthSq() === 0) return
    cam.position.add(step)
    smoothFocus.copy(tracked)
    orbitTarget.value = [tracked.x, tracked.y, tracked.z]
    return
  }
  if (isTracking) {
    focus.x = tracked.x
    focus.z = tracked.z
  }

  // Pull strength grows with distance, so a far pan snaps back faster than a small one.
  const magnetX = tracked.x - focus.x
  const magnetZ = tracked.z - focus.z
  const strength = Math.hypot(magnetX, magnetZ) * (cameraMagnet?.value ?? 0)
  focus.x += strength * magnetX * delta
  focus.z += strength * magnetZ * delta
  focus.y = tracked.y

  // Bruno lerps by delta * 10; the exp form feels the same without frame-rate drift.
  const easing = 1 - Math.exp(-(cameraEasing?.value ?? 10) * delta)
  smoothFocus.lerp(focus, easing)
  smoothZoom = MathUtils.lerp(smoothZoom, zoomRatio.value, easing)
  // Free mode takes this pose once, so skip the easing and land on it now.
  if (cameraFree?.value) {
    smoothFocus.copy(focus)
    smoothZoom = zoomRatio.value
  }

  const ratioOverflow = Math.max(1, IDEAL_RATIO / cam.aspect) - 1
  const radiusMax = (cameraRadiusMax?.value ?? 30) + ratioOverflow * NON_IDEAL_RATIO_OFFSET
  const radius = MathUtils.lerp(cameraRadiusMin?.value ?? 15, radiusMax, 1 - smoothZoom)

  offset.setFromSphericalCoords(
    radius,
    MathUtils.degToRad(cameraPhi?.value ?? 70),
    MathUtils.degToRad(cameraTheta?.value ?? 45),
  )

  cam.position.copy(smoothFocus).add(offset)
  cam.lookAt(smoothFocus)

  freePlaced = !!cameraFree?.value
  if (freePlaced) orbitTarget.value = [smoothFocus.x, smoothFocus.y, smoothFocus.z]
})

const { renderer } = useTresContext()
let canvas: HTMLCanvasElement | null = null
let dragging = false

function onWheel(event: WheelEvent) {
  if (cameraFree?.value) return
  event.preventDefault()
  // One wheel notch is about 100px of deltaY; Bruno's normalized spin is about 1.
  const step = (event.deltaY / 100) * (cameraZoomSensitivity?.value ?? 0.05)
  zoomRatio.value = MathUtils.clamp(zoomRatio.value - step, 0, 1)
}

function onPointerDown(event: PointerEvent) {
  // Bruno pans with any mouse drag; touch pan (two fingers) is not ported yet.
  if (event.pointerType === 'mouse') dragging = true
}

function onPointerMove(event: PointerEvent) {
  if (!dragging || cameraFree?.value || !cameraPan?.value || !canvas) return
  isTracking = false

  // Rotate screen movement by the azimuth so the map follows the cursor on screen.
  pan.set(event.movementX, event.movementY)
  pan.rotateAround(origin, -MathUtils.degToRad(cameraTheta?.value ?? 45))
  pan.multiplyScalar(10 / Math.min(canvas.clientWidth, canvas.clientHeight))

  focus.x -= pan.x * 2
  focus.z -= pan.y * 2
}

function onPointerUp() {
  dragging = false
}

onMounted(() => {
  canvas = renderer.instance?.domElement as HTMLCanvasElement | null
  if (!canvas) return
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  canvas?.removeEventListener('wheel', onWheel)
  canvas?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <TresPerspectiveCamera
    name="main-camera"
    :near="cameraNear"
    :far="cameraFar"
    :fov="cameraFov"
  />
  <!-- Debug only, like Bruno's MODE_FREE: the mouse owns the angle and distance, the loop only carries the camera along with the player. -->
  <OrbitControls
    v-if="cameraFree"
    :target="orbitTarget"
    enable-damping
  />
</template>
