<script setup lang="ts">
import { useControls } from '@tresjs/leches'
import { MathUtils, Spherical, Vector2, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'

// Follow camera, modelled on Bruno Simon's Folio 2025 View.js: zoom only moves along
// the view ray, dragging pans the focus point and a magnet pulls it back to the
// tracked target. Only the gamepad right stick changes the angle.
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
  cameraHeightSmoothing,
  cameraPan,
  cameraMagnet,
  cameraStickOrbit,
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
  // Seconds the height takes to settle. Separate from easing so small terrain bumps do not shake the view.
  heightSmoothing: { value: 0.35, min: 0, max: 1.5, step: 0.05, type: 'range' },
  pan: { value: true, type: 'boolean' },
  magnet: { value: 0.25, min: 0, max: 1, step: 0.01, type: 'range' },
  // Right-stick orbit speed in degrees per second at full tilt.
  stickOrbit: { value: 120, min: 0, max: 360, step: 5, type: 'range' },
  // Player height on screen, from the bottom: 0.5 is the center, 0.33 the lower third
  framing: { value: 0.33, min: 0.1, max: 0.9, step: 0.01, type: 'range' },
}, { uuid })

// The phone pose frames Chamo from the front, like a handheld selfie, with Chamo right of center so the phone panel fits on the left.
const {
  phoneDistance,
  phonePhi,
  phoneLookHeight,
  phoneShift,
  phoneDuration,
} = useControls('📱 phone', {
  distance: { value: 13, min: 3, max: 40, step: 0.5, type: 'range' },
  phi: { value: 76, min: 20, max: 95, step: 0.5, type: 'range' },
  lookHeight: { value: 1.1, min: 0, max: 3, step: 0.05, type: 'range' },
  shift: { value: 1.3, min: -4, max: 4, step: 0.05, type: 'range' },
  duration: { value: 0.8, min: 0.1, max: 3, step: 0.05, type: 'range' },
}, { uuid })

// Bruno adds radius when the viewport is narrower than 16:9 so the framing keeps its width.
const IDEAL_RATIO = 16 / 9
const NON_IDEAL_RATIO_OFFSET = 9

const tracked = new Vector3()
const focus = new Vector3(...props.target)
const smoothFocus = focus.clone()
const offset = new Vector3()
let heightVelocity = 0
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

// The right stick writes here; moving the panel sliders overrides it.
const PHI_MIN = 20
const PHI_MAX = 85
let theta = cameraTheta?.value ?? 22
let phi = cameraPhi?.value ?? 70
watch(() => cameraTheta?.value, (value) => { if (value !== undefined) theta = value })
watch(() => cameraPhi?.value, (value) => { if (value !== undefined) phi = value })

// A new target means the player moved: follow them again, like Bruno's resume on drive input.
watch(() => props.target, () => { isTracking = true }, { deep: true })

// Critically damped spring (Unity's SmoothDamp). Unlike a lerp it also smooths the speed, so each bump does not kink the motion.
function smoothHeight(current: number, target: number, smoothTime: number, delta: number) {
  if (smoothTime <= 0 || delta <= 0) {
    heightVelocity = 0
    return target
  }
  const omega = 2 / smoothTime
  const x = omega * delta
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  // Snap once settled, so free mode stops moving the camera instead of creeping forever.
  if (Math.abs(change) < 1e-4 && Math.abs(heightVelocity) < 1e-4) {
    heightVelocity = 0
    return target
  }
  const temp = (heightVelocity + omega * change) * delta
  heightVelocity = (heightVelocity - omega * temp) * decay
  return target + (change + temp) * decay
}

const phone = usePhone()
const dialog = useDialog()
const player = usePlayer()

// The dialog pose frames Chamo and the speaker from behind Chamo, turned `side` degrees off the line between them, high enough on screen for the dialog UI to fit below.
const {
  dialogSide,
  dialogDistance,
  dialogPhi,
  dialogLookHeight,
  dialogFraming,
  dialogDuration,
} = useControls('💬 dialog', {
  side: { value: 20, min: -90, max: 90, step: 1, type: 'range' },
  distance: { value: 17, min: 3, max: 40, step: 0.5, type: 'range' },
  phi: { value: 73, min: 20, max: 95, step: 0.5, type: 'range' },
  lookHeight: { value: 1.3, min: 0, max: 3, step: 0.05, type: 'range' },
  framing: { value: 0.68, min: 0.1, max: 0.9, step: 0.01, type: 'range' },
  duration: { value: 0.9, min: 0.1, max: 3, step: 0.05, type: 'range' },
}, { uuid })

// The pose the camera would take without a directed pose. A directed pose blends from it and back to it.
const basePosition = new Vector3()
const baseLook = new Vector3()
const blendLook = new Vector3()
const baseSpherical = new Spherical()
const screenRight = new Vector3()
// The last wanted directed pose. It stays after the phone or dialog closes, so the blend back does not jump.
const directedPose = { look: new Vector3(), spherical: new Spherical(), framing: 0.33, duration: 0.8 }
let directedWeight = 0
// Turns input off and disables OrbitControls, which would otherwise fight the directed pose for the camera.
const directing = ref(false)
// Disabled, not unmounted: v-if and template refs on OrbitControls both throw in Vue's patch inside the Tres renderer.
const { controls, renderer } = useTresContext()
watchEffect(() => {
  const orbit = controls.value as { enabled?: boolean } | null
  if (orbit && 'enabled' in orbit) orbit.enabled = !directing.value
})

function lerpAngle(from: number, to: number, alpha: number) {
  const delta = MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
  return from + delta * alpha
}

// Shifts the projection window, not the camera, so the angle, the zoom and the
// free-mode orbit stay the same. Sizes are in screen heights, so they do not depend
// on the canvas pixels. setViewOffset overwrites aspect with fullWidth / fullHeight,
// so fullWidth must be the current aspect or the image stretches.
function setFraming(cam: PerspectiveCamera, framing: number) {
  const offsetY = framing - 0.5
  if (cam.view?.offsetY !== offsetY || cam.view.fullWidth !== cam.aspect) {
    cam.setViewOffset(cam.aspect, 1, 0, offsetY, cam.aspect, 1)
  }
}

// Writes the wanted pose into `directedPose`. False when no pose is wanted.
function aimDirectedPose(baseFraming: number) {
  if (phone.open.value) {
    const yaw = player.yaw
    // Screen right while looking at Chamo's front.
    screenRight.set(Math.cos(yaw), 0, -Math.sin(yaw))
    directedPose.look.set(...props.target).addScaledVector(screenRight, -(phoneShift?.value ?? 1.3))
    directedPose.look.y += phoneLookHeight?.value ?? 1.1
    directedPose.spherical.set(phoneDistance?.value ?? 13, MathUtils.degToRad(phonePhi?.value ?? 76), yaw)
    directedPose.framing = baseFraming
    directedPose.duration = phoneDuration?.value ?? 0.8
    return true
  }

  const speakerPosition = dialog.speakerPosition.value
  if (speakerPosition) {
    const [px, py, pz] = props.target
    const [sx, sy, sz] = speakerPosition
    // Chamo can stop anywhere in the prompt's facing cone, so the angle follows the line between the two, not the speaker's facing.
    const behindChamo = Math.atan2(px - sx, pz - sz)
    directedPose.look.set((px + sx) / 2, (py + sy) / 2 + (dialogLookHeight?.value ?? 1.3), (pz + sz) / 2)
    directedPose.spherical.set(
      dialogDistance?.value ?? 17,
      MathUtils.degToRad(dialogPhi?.value ?? 73),
      behindChamo + MathUtils.degToRad(dialogSide?.value ?? 20),
    )
    directedPose.framing = dialogFraming?.value ?? 0.68
    directedPose.duration = dialogDuration?.value ?? 0.9
    return true
  }
  return false
}

// Returns false when no directed pose is in progress, so the caller places the camera itself.
function applyDirectedPose(cam: PerspectiveCamera, delta: number, baseFraming: number) {
  const wanted = aimDirectedPose(baseFraming)
  const goal = wanted ? 1 : 0
  directedWeight = MathUtils.clamp(directedWeight + Math.sign(goal - directedWeight) * delta / directedPose.duration, 0, 1)
  const active = directedWeight > 0 || wanted
  if (directing.value !== active) directing.value = active
  if (directedWeight === 0) return false

  baseSpherical.setFromVector3(offset.subVectors(basePosition, baseLook))

  // Orbits around the look point instead of cutting straight across, so a camera behind Chamo does not pass through them.
  const t = directedWeight * directedWeight * (3 - 2 * directedWeight)
  setFraming(cam, MathUtils.lerp(baseFraming, directedPose.framing, t))
  blendLook.lerpVectors(baseLook, directedPose.look, t)
  offset.setFromSphericalCoords(
    MathUtils.lerp(baseSpherical.radius, directedPose.spherical.radius, t),
    MathUtils.lerp(baseSpherical.phi, directedPose.spherical.phi, t),
    lerpAngle(baseSpherical.theta, directedPose.spherical.theta, t),
  )
  cam.position.copy(blendLook).add(offset)
  cam.lookAt(blendLook)
  return true
}

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, camera }) => {
  const cam = toValue(camera) as PerspectiveCamera | undefined
  if (!cam) return

  const baseFraming = cameraFraming?.value ?? 0.33
  setFraming(cam, baseFraming)

  tracked.set(...props.target)
  const heightTime = cameraHeightSmoothing?.value ?? 0.35
  if (cameraFree?.value && freePlaced) {
    // OrbitControls owns the free camera, so the base pose is wherever it left the camera when the directed pose began.
    if (directedWeight === 0) {
      basePosition.copy(cam.position)
      baseLook.copy(smoothFocus)
    }
    if (applyDirectedPose(cam, delta, baseFraming)) return
    step.set(
      tracked.x - smoothFocus.x,
      smoothHeight(smoothFocus.y, tracked.y, heightTime, delta) - smoothFocus.y,
      tracked.z - smoothFocus.z,
    )
    if (step.lengthSq() === 0) return
    cam.position.add(step)
    smoothFocus.add(step)
    orbitTarget.value = [smoothFocus.x, smoothFocus.y, smoothFocus.z]
    return
  }
  // Non-inverted: stick right turns the view right, stick up lowers the camera to look up.
  const look = directing.value ? null : readLookStick()
  if (look) {
    const speed = (cameraStickOrbit?.value ?? 120) * delta
    theta -= look.x * speed
    phi = MathUtils.clamp(phi - look.y * speed, PHI_MIN, PHI_MAX)
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
  const height = smoothFocus.y
  smoothFocus.lerp(focus, easing)
  smoothFocus.y = smoothHeight(height, focus.y, heightTime, delta)
  smoothZoom = MathUtils.lerp(smoothZoom, zoomRatio.value, easing)
  // Free mode takes this pose once, so skip the easing and land on it now.
  if (cameraFree?.value) {
    smoothFocus.copy(focus)
    heightVelocity = 0
    smoothZoom = zoomRatio.value
  }

  const ratioOverflow = Math.max(1, IDEAL_RATIO / cam.aspect) - 1
  const radiusMax = (cameraRadiusMax?.value ?? 30) + ratioOverflow * NON_IDEAL_RATIO_OFFSET
  const radius = MathUtils.lerp(cameraRadiusMin?.value ?? 15, radiusMax, 1 - smoothZoom)

  offset.setFromSphericalCoords(
    radius,
    MathUtils.degToRad(phi),
    MathUtils.degToRad(theta),
  )

  basePosition.copy(smoothFocus).add(offset)
  baseLook.copy(smoothFocus)
  if (!applyDirectedPose(cam, delta, baseFraming)) {
    cam.position.copy(basePosition)
    cam.lookAt(baseLook)
  }

  freePlaced = !!cameraFree?.value
  if (freePlaced) orbitTarget.value = [smoothFocus.x, smoothFocus.y, smoothFocus.z]
})

let canvas: HTMLCanvasElement | null = null
let dragging = false

function onWheel(event: WheelEvent) {
  if (cameraFree?.value) return
  event.preventDefault()
  if (directing.value) return
  // One wheel notch is about 100px of deltaY; Bruno's normalized spin is about 1.
  const step = (event.deltaY / 100) * (cameraZoomSensitivity?.value ?? 0.05)
  zoomRatio.value = MathUtils.clamp(zoomRatio.value - step, 0, 1)
}

function onPointerDown(event: PointerEvent) {
  // Bruno pans with any mouse drag; touch pan (two fingers) is not ported yet.
  if (event.pointerType === 'mouse') dragging = true
}

function onPointerMove(event: PointerEvent) {
  if (!dragging || cameraFree?.value || !cameraPan?.value || directing.value || !canvas) return
  isTracking = false

  // Rotate screen movement by the azimuth so the map follows the cursor on screen.
  pan.set(event.movementX, event.movementY)
  pan.rotateAround(origin, -MathUtils.degToRad(theta))
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
    make-default
    :target="orbitTarget"
    enable-damping
  />
</template>
