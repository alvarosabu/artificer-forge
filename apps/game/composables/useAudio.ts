import { useEventListener, useLocalStorage } from '@vueuse/core'
import type { InjectionKey } from 'vue'

export interface MixerSettings {
  master: number
  sfx: number
  ambience: number
  music: number
  muted: boolean
}

const MIXER_STORAGE_KEY = 'artificer-forge:mixer'

export const dbToGain = (db: number) => 10 ** (db / 20)

// SOUNDS keeps its literal type for SoundName, so read entries through the wider interface.
const definition = (name: SoundName): SoundDefinition => SOUNDS[name]

/** A random number between -amount and amount. */
const jitter = (amount = 0) => (Math.random() * 2 - 1) * amount

const DEFAULT_MAX_VOICES = 4

export interface PlayOptions {
  /** Added to the sound's own level, in dB. */
  volume?: number
  /** Added to the sound's own pitch, in cents. */
  pitch?: number
}


export function createAudio() {
  const context = new AudioContext()
  const buffers = new Map<string, AudioBuffer>()
  const loading = new Map<string, Promise<void>>()
  const lastTake = new Map<SoundName, number>()
  const voices = new Map<SoundName, { source: AudioBufferSourceNode, gain: GainNode }[]>()

  const limiter = new DynamicsCompressorNode(context, { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.1 })
  const master = new GainNode(context)
  master.connect(limiter).connect(context.destination)
  const buses: Record<BusName, GainNode> = {
    sfx: new GainNode(context),
    ambience: new GainNode(context),
    music: new GainNode(context),
  }
  for (const bus of Object.values(buses)) bus.connect(master)

  // mergeDefaults fills in a fader that an older saved copy does not have.
  const mixer = useLocalStorage<MixerSettings>(
    MIXER_STORAGE_KEY,
    { master: 0, sfx: 0, ambience: -6, music: -12, muted: false },
    { mergeDefaults: true },
  )
  watch(mixer, (settings) => {
    master.gain.value = settings.muted ? 0 : dbToGain(settings.master)
    for (const name of Object.keys(buses) as BusName[]) buses[name].gain.value = dbToGain(settings[name])
  }, { deep: true, immediate: true })

  function loadFile(url: string) {
    let pending = loading.get(url)
    if (!pending) {
      pending = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
          return response.arrayBuffer()
        })
        .then(data => context.decodeAudioData(data))
        .then((buffer) => { buffers.set(url, buffer) })
        // One missing file must not break the others: the sound just stays silent.
        .catch(error => console.warn(`[audio] could not load ${url}:`, error))
      loading.set(url, pending)
    }
    return pending
  }

  function load(...names: SoundName[]) {
    return Promise.all(names.flatMap(name => definition(name).files.map(loadFile)))
  }

  function pickTake(name: SoundName, count: number) {
    const last = lastTake.get(name)
    const take = last === undefined || count < 2
      ? Math.floor(Math.random() * count)
      : (last + 1 + Math.floor(Math.random() * (count - 1))) % count
    lastTake.set(name, take)
    return take
  }

  function play(name: SoundName, options: PlayOptions = {}) {
    if (context.state !== 'running') return
    const sound = definition(name)
    const buffer = buffers.get(sound.files[pickTake(name, sound.files.length)]!)
    if (!buffer) return

    const source = new AudioBufferSourceNode(context, { buffer, detune: jitter(sound.pitchJitter) })
    const gain = new GainNode(context, {
      gain: dbToGain((sound.volume ?? 0) + (options.volume ?? 0) + jitter(sound.volumeJitter)),
    })

    source.connect(gain).connect(buses[sound.bus ?? 'sfx'])
    source.start()

    const playing = voices.get(name) ?? []
    voices.set(name, playing)
    if (playing.length >= (sound.maxVoices ?? DEFAULT_MAX_VOICES)) {
      const oldest = playing.shift()!
      // stop() alone cuts the wave mid-swing, which clicks. A 10 ms fade first is silent.
      oldest.gain.gain.setTargetAtTime(0, context.currentTime, 0.01)
      oldest.source.stop(context.currentTime + 0.05)
    }
    const voice = { source, gain }
    playing.push(voice)
    source.onended = () => {
      const index = playing.indexOf(voice)
      if (index >= 0) playing.splice(index, 1)
    }
  }

  function unlock() {
    if (context.state === 'suspended') context.resume()
  }
  useEventListener(window, ['pointerdown', 'keydown'], unlock)

  function dispose() {
    context.close()
  }

  return { context, load, play, dispose, mixer }
}

export type GameAudio = ReturnType<typeof createAudio>

const AudioKey: InjectionKey<GameAudio> = Symbol('audio')

export function provideAudio(audio: GameAudio) {
  provide(AudioKey, audio)
}

export function useAudio() {
  const audio = inject(AudioKey, null)
  if (!audio) throw new Error('useAudio() needs an <AudioController> ancestor')
  return audio
}