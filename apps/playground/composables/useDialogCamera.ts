import { gsap } from 'gsap'
import { Vector3 } from 'three'
import type { EntityState } from '~/stores/game'
import type { DialogNode } from './useDialogEngine'

type ShotPreset = NonNullable<DialogNode['cameraShot']>

interface ShotConfig {
  /** Distance behind the listener along the listener→speaker axis */
  back: number
  /** Lateral offset (left/right of the axis) so the camera looks past the shoulder, not through the head */
  side: number
  /** Camera height above the ground */
  height: number
  /** Look-at Y on the speaker (head ≈ 1.6) */
  lookHeight: number
  /** For closeup/wide/three-quarter: distance from the speaker instead (no listener anchor) */
  distance?: number
}

const SHOT_PRESETS: Record<ShotPreset, ShotConfig> = {
  // Default: anchored on the SPEAKER, offset to one side at a 3/4 angle.
  // Both characters in frame, speaker clearly visible, listener as side element.
  'three-quarter': { back: 0, side: 2.8, height: 1.85, lookHeight: 1.55, distance: 2.8 },
  // Classic OTS: behind + above + to the side of the listener, framing past their shoulder.
  'over-shoulder': { back: 3.5, side: 1.2, height: 2.1, lookHeight: 1.55 },
  // Pulled in close on the speaker, slight off-axis.
  'closeup':       { back: 0, side: 0.6, height: 1.7, lookHeight: 1.55, distance: 2.2 },
  // Wide reaction shot.
  'wide':          { back: 0, side: 1.8, height: 2.4, lookHeight: 1.4, distance: 6.0 },
  // Both speakers in frame (handled separately in computeFraming).
  'two-shot':      { back: 0, side: 0, height: 2.2, lookHeight: 1.4, distance: 5.0 },
}

interface Framing {
  position: Vector3
  target: Vector3
}

/**
 * Cinematic camera director for dialog scenes.
 * Subscribes to dialog store state and tweens the active camera to frame the speaker.
 * Must be used inside a TresCanvas context (active camera available via useTresContext).
 */
export function useDialogCamera() {
  const { camera } = useTresContext()
  const gameStore = useGameStore()
  const dialogStore = useDialogStore()

  // Snapshot of pre-dialog camera transform (restored on close).
  const snapshot = {
    position: new Vector3(),
    target: new Vector3(),
    taken: false,
  }
  // The Vector3 we drive lookAt against; mutated by GSAP onUpdate.
  const liveTarget = new Vector3()
  let activeTween: gsap.core.Tween | null = null

  function asVector(p: { x: number, y: number, z: number }) {
    return new Vector3(p.x, p.y, p.z)
  }

  function findSpeaker(node: DialogNode | null): EntityState | null {
    if (!node?.speaker) return null
    for (const e of gameStore.entities.values()) {
      if (e.templateId === node.speaker) return e
    }
    return null
  }

  function findListener(speaker: EntityState | null): EntityState | null {
    const leaderId = gameStore.party.leader
    if (!leaderId) return null
    const leader = gameStore.entities.get(leaderId) ?? null
    if (speaker && leader && leader.id === speaker.id) {
      // Speaker is the player — listener is the first non-player entity referenced earlier.
      // Fallback: use any non-party character.
      for (const e of gameStore.entities.values()) {
        if (e.type === 'character' && e.id !== leader.id) return e
      }
    }
    return leader
  }

  function computeFraming(node: DialogNode | null): Framing | null {
    const speaker = findSpeaker(node)
    if (!speaker) return null

    const shot = node?.cameraShot ?? 'three-quarter'
    const cfg = SHOT_PRESETS[shot]
    const speakerPos = asVector(speaker.position)

    if (shot === 'two-shot') {
      const listener = findListener(speaker)
      const listenerPos = listener ? asVector(listener.position) : speakerPos.clone()
      const mid = speakerPos.clone().add(listenerPos).multiplyScalar(0.5)
      const axis = speakerPos.clone().sub(listenerPos)
      const separation = Math.max(axis.length(), 1)
      // Sit perpendicular to the line between them, pulled back proportional to separation.
      const perp = new Vector3(-axis.z, 0, axis.x).normalize().multiplyScalar((cfg.distance ?? 5) + separation * 0.5)
      const position = mid.clone().add(perp).setY(cfg.height)
      const target = mid.clone().setY(cfg.lookHeight)
      return { position, target }
    }

    const listener = findListener(speaker)
    const listenerPos = listener ? asVector(listener.position) : null

    // Axis = unit direction listener → speaker (fallback: world +Z).
    const axis = listenerPos
      ? speakerPos.clone().sub(listenerPos)
      : new Vector3(0, 0, 1)
    axis.y = 0
    if (axis.lengthSq() < 0.0001) axis.set(0, 0, 1)
    axis.normalize()

    // Perpendicular to the axis, on the ground plane — used for lateral offset.
    const side = new Vector3(-axis.z, 0, axis.x)

    let position: Vector3
    if (shot === 'over-shoulder' && listenerPos) {
      // Stand behind the listener (-axis * back) and step to their shoulder (+side * sideOffset).
      position = listenerPos
        .clone()
        .add(axis.clone().multiplyScalar(-cfg.back))
        .add(side.clone().multiplyScalar(cfg.side))
        .setY(cfg.height)
    }
    else {
      // Closeup / wide / no-listener fallback: pull back from the speaker along -axis.
      const dist = cfg.distance ?? 3
      position = speakerPos
        .clone()
        .add(axis.clone().multiplyScalar(-dist))
        .add(side.clone().multiplyScalar(cfg.side))
        .setY(cfg.height)
    }

    const target = speakerPos.clone().setY(cfg.lookHeight)
    return { position, target }
  }

  function takeSnapshot() {
    if (!camera.activeCamera.value || snapshot.taken) return
    snapshot.position.copy(camera.activeCamera.value.position)
    // Best-effort target: look 1m forward along current orientation.
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.activeCamera.value.quaternion)
    snapshot.target.copy(camera.activeCamera.value.position).add(forward)
    snapshot.taken = true
  }

  function tweenTo(framing: Framing, duration = 0.8) {
    if (!camera.activeCamera.value) return
    activeTween?.kill()
    liveTarget.copy(framing.target)
    const cam = camera.activeCamera.value
    activeTween = gsap.to({}, {
      duration,
      ease: 'power2.inOut',
      onStart: () => {
        // Capture starting target so we can interpolate it too.
        const startTarget = liveTarget.clone()
        const startPos = cam.position.clone()
        activeTween!.eventCallback('onUpdate', () => {
          const t = activeTween!.progress()
          // Easing already applied via gsap progress mapping; manual lerp keeps target/position synced.
          cam.position.lerpVectors(startPos, framing.position, t)
          liveTarget.lerpVectors(startTarget, framing.target, t)
          cam.lookAt(liveTarget)
        })
      },
    })
  }

  function focusNode(node: DialogNode | null) {
    const framing = computeFraming(node)
    if (!framing) return
    if (!snapshot.taken) takeSnapshot()
    tweenTo(framing)
  }

  function restore() {
    if (!camera.activeCamera.value || !snapshot.taken) return
    const cam = camera.activeCamera.value
    const startPos = cam.position.clone()
    const startTarget = liveTarget.clone()
    activeTween?.kill()
    activeTween = gsap.to({}, {
      duration: 0.6,
      ease: 'power2.inOut',
      onStart: () => {
        activeTween!.eventCallback('onUpdate', () => {
          const t = activeTween!.progress()
          cam.position.lerpVectors(startPos, snapshot.position, t)
          liveTarget.lerpVectors(startTarget, snapshot.target, t)
          cam.lookAt(liveTarget)
        })
      },
      onComplete: () => {
        snapshot.taken = false
      },
    })
  }

  // Drive the camera off dialog state changes.
  watch(
    () => dialogStore.currentNodeId,
    (nodeId, prev) => {
      if (nodeId && nodeId !== prev) {
        focusNode(dialogStore.currentNode)
      }
      else if (!nodeId && prev) {
        restore()
      }
    },
  )

  onBeforeUnmount(() => {
    activeTween?.kill()
  })
}
