import { EXPRESSIONS } from './useCharacterFace'
import type { ExpressionName, CharacterFace } from './useCharacterFace'

const GROUP_ID = 'face'

/** Dev palette commands that switch Chamo's expression. */
export function useCharacterFaceCommands(face: CharacterFace) {
  const { registerGroup, unregisterGroup, close } = useCommandPalette()

  registerGroup({
    id: GROUP_ID,
    label: 'Face',
    items: (Object.keys(EXPRESSIONS) as ExpressionName[]).map(name => ({
      id: `face-${name}`,
      label: `Face: ${name}`,
      icon: 'i-lucide-smile',
      onSelect: () => {
        face.expression.value = name
        close()
      },
    })),
  })

  onUnmounted(() => unregisterGroup(GROUP_ID))
}