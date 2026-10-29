import { MathUtils } from "three"

export type BusName = 'sfx' | 'ambience' | 'music'

export interface SoundDefinition {
  /** Takes of the same sound. Each play picks one, never the same one twice in a row. */
  files: string[]
  /** The mixer bus the sound plays through. Defaults to sfx. */
  bus?: BusName
  /** Level in dB. 0 plays the file as recorded, -6 at half the amplitude. */
  volume?: number
  /** Each play moves the pitch up or down by up to this many cents. 100 cents is a semitone. */
  pitchJitter?: number
  /** Each play moves the level up or down by up to this many dB. */
  volumeJitter?: number
  /** At most this many copies play at once. A new play stops the oldest. Defaults to 4. */
  maxVoices?: number
}

const takes = (name: string, count: number) =>
  Array.from({ length: count }, (_, i) => `/audio/sfx/${name}-${String(i + 1).padStart(2, '0')}.ogg`)

export const SOUNDS = {
  stepSand: { files: takes('step-sand', 6), volume: -10, pitchJitter: 150, volumeJitter: 2 },
  stepGrass: { files: takes('step-grass', 5), volume: -4, pitchJitter: 150, volumeJitter: 2 },
  stepWood: { files: takes('step-wood', 5), volume: -6, pitchJitter: 150, volumeJitter: 2 },
  stepWater: { files: takes('step-water', 5), volume: -2, pitchJitter: 200, volumeJitter: 3 },
  land: { files: takes('land', 5), volume: -6, pitchJitter: 100, volumeJitter: 1 },
  splash: { files: takes('splash', 13), volume: 0, pitchJitter: 100, volumeJitter: 1 },
  swim: { files: takes('step-water', 5), volume: -8, pitchJitter: 300, volumeJitter: 3 },
} satisfies Record<string, SoundDefinition>

export type SoundName = keyof typeof SOUNDS

export function impactLevel({
  impactSpeed,
  quietImpact = 0.5,
  loudImpact = 1.5,
  quietImpactLevel = -6,
}: {
  impactSpeed: number
  quietImpact?: number
  loudImpact?: number
  quietImpactLevel?: number
}) {
  const t = MathUtils.clamp((impactSpeed - quietImpact) / (loudImpact - quietImpact), 0, 1)
  return quietImpactLevel * (1 - t)
}