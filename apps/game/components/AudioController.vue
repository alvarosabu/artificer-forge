<script setup lang="ts">
import { Vector3 } from 'three'
import type { Camera } from 'three'

const props = defineProps<{
  /** 0 to 1 around the day cycle, as useDayCycle counts it. */
  dayPhase: number
}>()

// Lives inside <TresCanvas>, which only renders on the client: the server has no AudioContext.
const audio = createAudio()
provideAudio(audio)
onUnmounted(() => audio.dispose())

// Takes audio as an argument: a component cannot inject what it provides itself.
useDayNightMusic(audio, () => props.dayPhase)

const uuid = inject<string>('uuid')
const fader = (value: number) => ({ value, min: -40, max: 6, step: 1, type: 'range' })
const { audioMaster, audioSfx, audioAmbience, audioMusic, audioMuted } = useControls('🔊 audio', {
  master: fader(audio.mixer.value.master),
  sfx: fader(audio.mixer.value.sfx),
  ambience: fader(audio.mixer.value.ambience),
  music: fader(audio.mixer.value.music),
  muted: { value: audio.mixer.value.muted, type: 'boolean' },
}, { uuid })

watch(audioMaster!, (v) => { audio.mixer.value.master = v })
watch(audioSfx!, (v) => { audio.mixer.value.sfx = v })
watch(audioAmbience!, (v) => { audio.mixer.value.ambience = v })
watch(audioMusic!, (v) => { audio.mixer.value.music = v })
watch(audioMuted!, (v) => { audio.mixer.value.muted = v })

const sfxSounds = (Object.entries(SOUNDS) as [SoundName, SoundDefinition][])
  .filter(([, sound]) => (sound.bus ?? 'sfx') === 'sfx')
const sfxControls = useControls('🔉 sfx', Object.fromEntries(
  sfxSounds.map(([name, sound]) => [name, fader(sound.volume ?? 0)]),
), { uuid }) as Record<string, Ref<number>>
for (const [name] of sfxSounds) {
  // leches prefixes each key with the folder word: stepSand reads back as sfxStepSand
  watch(sfxControls[`sfx${name[0]!.toUpperCase()}${name.slice(1)}`]!, (v) => { audio.levels[name] = v })
}

// The camera sits 15 to 30 m from the player, so ears there hear every nearby sound as far away.
// The ears go on the player and take only their direction from the camera.
const EAR_HEIGHT = 1.5
const player = usePlayerPosition()
const ears = new Vector3()
const forward = new Vector3()
const up = new Vector3()

const { onBeforeRender } = useLoop()
onBeforeRender(({ camera }) => {
  const view = toValue(camera) as Camera | undefined
  if (!view) return
  view.getWorldDirection(forward)
  // The camera looks down, so its up is not +Y. A wrong up tilts left and right.
  up.setFromMatrixColumn(view.matrixWorld, 1)
  const [x, y, z] = player.value
  audio.setListener(ears.set(x, y + EAR_HEIGHT, z), forward, up)
})
</script>

<template>
  <slot />
</template>