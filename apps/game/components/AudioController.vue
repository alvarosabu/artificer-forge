<script setup lang="ts">
// Lives inside <TresCanvas>, which only renders on the client: the server has no AudioContext.
const audio = createAudio()
provideAudio(audio)
onUnmounted(() => audio.dispose())

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
</script>

<template>
  <slot />
</template>