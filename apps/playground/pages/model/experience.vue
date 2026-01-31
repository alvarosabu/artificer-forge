<script setup lang="ts">
import { Floor } from '@gamelab/components'
</script>

<template>
    <TresFog :args="['#020420', 10, 15]" />
   <TresPerspectiveCamera :position="[5, 5, 5]" :near="0.1" :far="100" />
    <OrbitControls />
    <TresAmbientLight :intensity="0.8" />
    <TresDirectionalLight
      :position="[5, 5, 5]"
      :intensity="1.5"
      cast-shadow
    />
    <Suspense>
      <Character />
    </Suspense>
    <TresAxesHelper />
    <Floor />
</template>