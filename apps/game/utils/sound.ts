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
  stepSand: { files: takes('step-sand', 6), volume: -20, pitchJitter: 150, volumeJitter: 2 },
  stepGrass: { files: takes('step-grass', 5), volume: -16, pitchJitter: 150, volumeJitter: 2 },
  stepWood: { files: takes('step-wood', 5), volume: -12, pitchJitter: 150, volumeJitter: 2 },
  stepWater: { files: takes('step-water', 5), volume: -12, pitchJitter: 200, volumeJitter: 3 },
  land: { files: takes('land', 5), volume: -11, pitchJitter: 100, volumeJitter: 1 },
  splash: { files: [...takes('splash', 3), '/audio/sfx/splash-13.ogg'], volume: 0, pitchJitter: 100, volumeJitter: 1 },
  splashBig: { files: ['/audio/sfx/splash-big.ogg'], volume: 0, pitchJitter: 150, volumeJitter: 1 },
  swim: { files: takes('step-water', 5), volume: -8, pitchJitter: 300, volumeJitter: 3 },
  // Synthesized placeholder knocks. Our recorded thuds are almost all below 150 Hz, which laptop speakers drop.
  hit: { files: takes('hit', 3), volume: 0, pitchJitter: 200, volumeJitter: 1, maxVoices: 8 },
  surf: { files: ['/audio/ambience/surf.ogg'], bus: 'ambience', volume: 6 },
  wind: { files: ['/audio/ambience/wind.ogg'], bus: 'ambience', volume: 0 },
  // The recording averages about -41 dB, so it needs the boost.
  fire: { files: ['/audio/ambience/fire.ogg'], bus: 'ambience', volume: 12 },
  // Streamed with audio.stream(), never decoded: load() on these would hold minutes of raw samples.
  musicDay: { files: ['/audio/music/day.ogg'], bus: 'music' },
  musicNight: { files: ['/audio/music/night.ogg'], bus: 'music' },
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