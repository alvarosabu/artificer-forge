import { useDocumentVisibility, useEventListener, useLocalStorage } from '@vueuse/core'
import type { Vector3 } from 'three'
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

// -60 dB. A stream below this pauses.
const SILENT_GAIN = 1e-3

export interface Stream {
  /** Eases the linear gain toward `value`. At 0 the track pauses once the fade is over. */
  setGain: (value: number, smoothing?: number) => void
  stop: () => void
}

export interface PlayOptions {
  /** Added to the sound's own level, in dB. */
  volume?: number
  /** Added to the sound's own pitch, in cents. */
  pitch?: number
  /** Plays the sound from this world point instead of from everywhere. */
  position?: Vector3
  /** Full level within this many metres of `position`. Defaults to REF_DISTANCE. */
  refDistance?: number
  /** How fast the level falls past `refDistance`. Defaults to ROLLOFF. */
  rolloff?: number
}

export interface LoopOptions {
  /** Adds a low-pass filter, so setCutoff can take the top off the sound. */
  lowpass?: boolean
  /** Plays the sound from this world point instead of from everywhere. */
  position?: Vector3
}

// Full level within REF_DISTANCE metres, then the inverse model takes over.
export const REF_DISTANCE = 1.5
export const ROLLOFF = 1.5

export interface Loop {
  /** Eases the level toward `db`, on top of the sound's own level. -Infinity fades it out. */
  setVolume: (db: number, smoothing?: number) => void
  /** Eases the low-pass cutoff toward `hz`. Needs `lowpass` in the options. */
  setCutoff: (hz: number, smoothing?: number) => void
  /** Full level within `refDistance` metres, then `rolloff` sets how fast it falls. Needs `position`. */
  setFalloff: (refDistance: number, rolloff: number) => void
  /** Fades out over `fade` seconds, then frees the nodes. */
  stop: (fade?: number) => void
}

export function createAudio() {
  const context = new AudioContext()
  const buffers = new Map<string, AudioBuffer>()
  const loading = new Map<string, Promise<void>>()
  const lastTake = new Map<SoundName, number>()
  const voices = new Map<SoundName, { source: AudioBufferSourceNode, gain: GainNode }[]>()
  /** Live overrides of each sound's `volume` in dB, set from the debug panel. */
  const levels: Partial<Record<SoundName, number>> = {}
  const levelOf = (name: SoundName) => levels[name] ?? definition(name).volume ?? 0

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
    { master: 0, sfx: -5, ambience: -9, music: -12, muted: false },
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

  function createPanner(position: Vector3, refDistance = REF_DISTANCE, rolloff = ROLLOFF) {
    return new PannerNode(context, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance,
      rolloffFactor: rolloff,
      positionX: position.x,
      positionY: position.y,
      positionZ: position.z,
    })
  }

  function play(name: SoundName, options: PlayOptions = {}) {
    if (context.state !== 'running') return
    const sound = definition(name)
    const buffer = buffers.get(sound.files[pickTake(name, sound.files.length)]!)
    if (!buffer) return

    const source = new AudioBufferSourceNode(context, { buffer, detune: (options.pitch ?? 0) + jitter(sound.pitchJitter) })
    const gain = new GainNode(context, {
      gain: dbToGain(levelOf(name) + (options.volume ?? 0) + jitter(sound.volumeJitter)),
    })

    const bus = buses[sound.bus ?? 'sfx']
    const panner = options.position ? createPanner(options.position, options.refDistance, options.rolloff) : null
    source.connect(gain).connect(panner ?? bus)
    panner?.connect(bus)
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
      panner?.disconnect()
    }
  }

  // A jump in a gain clicks, and a jump on every frame buzzes, so ease toward the value instead.
  function approach(param: AudioParam, value: number, smoothing: number) {
    param.setTargetAtTime(value, context.currentTime, smoothing)
  }

  /** A sound that repeats until stop(). It starts silent, so set its level after creating it. */
  function loop(name: SoundName, options: LoopOptions = {}): Loop {
    const sound = definition(name)
    const url = sound.files[0]!
    const gain = new GainNode(context, { gain: 0 })
    const filter = options.lowpass ? new BiquadFilterNode(context, { type: 'lowpass', frequency: 20000 }) : null
    const panner = options.position ? createPanner(options.position) : null
    const bus = buses[sound.bus ?? 'sfx']
    panner?.connect(bus)
    gain.connect(panner ?? bus)
    filter?.connect(gain)

    let source: AudioBufferSourceNode | null = null
    let stopped = false
    loadFile(url).then(() => {
      const buffer = buffers.get(url)
      if (!buffer || stopped) return
      source = new AudioBufferSourceNode(context, { buffer, loop: true })
      source.connect(filter ?? gain)
      // A random start point, so two loops of the same file do not play in step.
      source.start(0, Math.random() * buffer.duration)
    })

    return {
      setVolume: (db, smoothing = 0.5) => approach(gain.gain, dbToGain(levelOf(name) + db), smoothing),
      setCutoff: (hz, smoothing = 0.5) => {
        if (filter) approach(filter.frequency, hz, smoothing)
      },
      setFalloff: (refDistance, rolloff) => {
        if (!panner) return
        panner.refDistance = refDistance
        panner.rolloffFactor = rolloff
      },
      stop: (fade = 0) => {
        stopped = true
        if (fade > 0) approach(gain.gain, 0, fade / 4)
        source?.stop(context.currentTime + fade)
        // Disconnecting before the fade ends cuts off the tail.
        setTimeout(() => {
          gain.disconnect()
          panner?.disconnect()
        }, fade * 1000 + 50)
      },
    }
  }

  /** Puts the ears at `position`, facing `forward` with the top of the head toward `up`. */
  function setListener(position: Vector3, forward: Vector3, up: Vector3) {
    const { listener } = context
    // Firefox has no AudioParams on the listener, only the older setters.
    if (!listener.positionX) {
      listener.setPosition(position.x, position.y, position.z)
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)
      return
    }
    listener.positionX.value = position.x
    listener.positionY.value = position.y
    listener.positionZ.value = position.z
    listener.forwardX.value = forward.x
    listener.forwardY.value = forward.y
    listener.forwardZ.value = forward.z
    listener.upX.value = up.x
    listener.upY.value = up.y
    listener.upZ.value = up.z
  }

  const streams = new Set<HTMLAudioElement>()

  /** A long track that plays from the file as it downloads, instead of being decoded into memory first. */
  function stream(name: SoundName): Stream {
    const sound = definition(name)
    const element = new Audio(sound.files[0])
    element.loop = true
    const gain = new GainNode(context, { gain: 0 })
    new MediaElementAudioSourceNode(context, { mediaElement: element }).connect(gain).connect(buses[sound.bus ?? 'music'])
    streams.add(element)

    let pauseTimer: ReturnType<typeof setTimeout> | undefined
    return {
      setGain: (value, smoothing = 1) => {
        approach(gain.gain, value * dbToGain(levelOf(name)), smoothing)
        // Not `> 0`: cos(π/2) is 6e-17, so a crossfade never gives exactly 0.
        if (value > SILENT_GAIN) {
          clearTimeout(pauseTimer)
          pauseTimer = undefined
          // Called again on every update, so a track asked for before the unlock starts once the context runs.
          if (element.paused && context.state === 'running') element.play().catch(() => {})
          return
        }
        // Started once: setGain runs on every update, and restarting the timer each time means it never fires.
        if (pauseTimer !== undefined || element.paused) return
        // After five time constants less than 1% is left. Pause then, so a silent track stops decoding.
        pauseTimer = setTimeout(() => {
          pauseTimer = undefined
          element.pause()
        }, smoothing * 5000)
      },
      stop: () => {
        clearTimeout(pauseTimer)
        element.pause()
        element.removeAttribute('src')
        streams.delete(element)
        gain.disconnect()
      },
    }
  }

  // The context starts suspended until the page gets a click or a key press.
  let unlocked = false
  function unlock() {
    unlocked = true
    if (context.state === 'suspended') context.resume()
  }
  useEventListener(window, ['pointerdown', 'keydown'], unlock)

  // A hidden tab keeps playing. Suspend the context and pause the music, then pick up where they were.
  const pausedByHide = new Set<HTMLAudioElement>()
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'hidden') {
      if (context.state === 'running') context.suspend()
      for (const element of streams) {
        if (element.paused) continue
        element.pause()
        pausedByHide.add(element)
      }
      return
    }
    // visibilitychange is not a user gesture, so before the first unlock the browser refuses resume().
    if (unlocked && context.state === 'suspended') context.resume()
    for (const element of pausedByHide) element.play().catch(() => {})
    pausedByHide.clear()
  })

  function dispose() {
    for (const element of streams) element.pause()
    context.close()
  }

  return { context, load, play, loop, stream, setListener, dispose, mixer, levels }
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