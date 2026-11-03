import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import type { GradingContext } from '@artificer-forge/engine/runtime'
import { createFaceMaterial, type FaceMaterial } from '~/utils/faceMaterial'

const EYES_GRID: AtlasGrid = { columns: 3, rows: 6 }
const MOUTH_GRID: AtlasGrid = { columns: 2, rows: 4 }
/** Atlas cells in reading order: left to right, then top to bottom. */
export const EYE_CELLS = ['neutral', 'angry', 'surprised', 'skeptical', 'happyClosed', 'hurt', 'sparkle'] as const
export const MOUTH_CELLS = ['flat', 'wavy', 'smile', 'smallOpen', 'bigSmile', 'o'] as const
export type EyeCell = typeof EYE_CELLS[number]
export type MouthCell = typeof MOUTH_CELLS[number]


export const EXPRESSIONS = {
  neutral: { eyes: 'neutral', mouth: 'flat' },
  determined: { eyes: 'angry', mouth: 'flat' },
  surprised: { eyes: 'surprised', mouth: 'o' },
  skeptical: { eyes: 'skeptical', mouth: 'wavy' },
  happy: { eyes: 'happyClosed', mouth: 'bigSmile' },
  hurt: { eyes: 'hurt', mouth: 'wavy' },
  excited: { eyes: 'sparkle', mouth: 'bigSmile' },
  puffing: { eyes: 'neutral', mouth: 'smallOpen' },
} satisfies Record<string, { eyes: EyeCell, mouth: MouthCell }>
export type ExpressionName = keyof typeof EXPRESSIONS

const BLINKS_FROM: readonly EyeCell[] = ['neutral', 'surprised', 'sparkle']
const BLINK_TIME = 0.12
const BLINK_GAP_MIN = 2
const BLINK_GAP_MAX = 5
const DOUBLE_BLINK_CHANCE = 0.2
const DOUBLE_BLINK_GAP = 0.25

/** Gives Chamo's eye and mouth meshes their own material. Call `attach` before the grading runs on the model. */
export function useCharacterFace(grading: GradingContext) {
    
  let eyes: FaceMaterial | undefined
  let mouth: FaceMaterial | undefined
  const expression = ref<ExpressionName>('neutral')
  let blinkAt = BLINK_GAP_MIN
  let blinkUntil = 0

  function nextBlinkGap() {
    if (Math.random() < DOUBLE_BLINK_CHANCE) return DOUBLE_BLINK_GAP
    return BLINK_GAP_MIN + Math.random() * (BLINK_GAP_MAX - BLINK_GAP_MIN)
  }

  function applyFaceMaterial(model: Object3D, name: string, grid: AtlasGrid) {
    const mesh = model.getObjectByName(name) as Mesh | undefined
    if (!mesh) return undefined
    // useGLTF caches the model, so on a remount the mesh already has a face material.
    const source = (mesh.userData.faceSource ??= mesh.material) as MeshStandardMaterial
    const face = createFaceMaterial(source, grid, grading)
    mesh.material = face.material
    return face
  }

  function attach(model: Object3D) {
    eyes = applyFaceMaterial(model, 'Eyes', EYES_GRID)
    mouth = applyFaceMaterial(model, 'Mouth', MOUTH_GRID)
  }

  const { onBeforeRender } = useLoop()
  onBeforeRender(({ elapsed }) => {
    if (elapsed >= blinkAt) {
      blinkUntil = elapsed + BLINK_TIME
      blinkAt = blinkUntil + nextBlinkGap()
    }

    const shown = EXPRESSIONS[expression.value]
    const blinking = elapsed < blinkUntil && BLINKS_FROM.includes(shown.eyes)
    eyes?.showCell(EYE_CELLS.indexOf(blinking ? 'happyClosed' : shown.eyes))
    mouth?.showCell(MOUTH_CELLS.indexOf(shown.mouth))
  })

  onUnmounted(() => {
    eyes?.material.dispose()
    mouth?.material.dispose()
  })

  return { attach, expression }
}

export type CharacterFace = ReturnType<typeof useCharacterFace>