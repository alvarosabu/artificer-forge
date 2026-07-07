<script setup lang="ts">
// M3 verification page: two independent useModularRig instances side by side.
// Different parts/colors per instance + one armored — proves clone-per-instance
// (no mesh stealing, no tint bleed) on the default WebGL renderer.
import type { CharacterAppearance } from '@artificer-forge/engine/core'
import type { ArmorPiece } from '@artificer-forge/engine/runtime'

useHead({ title: 'Modular Rig Test - TresJS Playground' })

const male: CharacterAppearance = {
  body: 'HUM_M_MEDIUM_Body_A',
  head: 'HUM_M_Head_A',
  hair: 'GEN_M_Hair_Short_A',
  beard: 'GEN_Beard_Short_A',
  eyebrows: 'GEN_Eyebrows_Thin_A',
  horns: null,
  skinColor: '#eecbb0',
  hairColor: '#3b2417',
}

const female: CharacterAppearance = {
  body: 'HUM_F_MEDIUM_Body_A',
  head: 'HUM_F_Head_A',
  hair: 'GEN_F_Hair_Long_A',
  beard: null,
  eyebrows: 'GEN_Eyebrows_Thin_B',
  horns: null,
  skinColor: '#8d5524',
  hairColor: '#b0413e',
}

const maleArmor: ArmorPiece[] = [
  { id: 'ARM_M_MEDIUM_Leather_Jerkin', path: '/models/characters/armors/ARM_M_MEDIUM_Leather_Jerkin.glb', hides: ['torso'], tint: '/models/characters/armors/leather_jerkin_crimson.png' },
  { id: 'common_pants', path: '/models/characters/trousers/common_pants.glb', hides: ['hips', 'leg'] },
  { id: 'leather_sandals', path: '/models/characters/boots/leather_sandals.glb', hides: ['foot'] },
]

const femaleArmor: ArmorPiece[] = [
  { id: 'ARM_F_MEDIUM_Leather_Jerkin', path: '/models/characters/armors/ARM_F_MEDIUM_Leather_Jerkin.glb', hides: ['torso'] },
]
</script>

<template>
  <div class="w-full h-screen">
    <TresCanvas
      clear-color="#1a1a2e"
      shadows
    >
      <TresPerspectiveCamera :position="[0, 2, 5]" :look-at="[0, 1, 0]" />
      <TresAmbientLight :intensity="0.8" />
      <TresDirectionalLight
        :position="[5, 5, 5]"
        :intensity="1.5"
        cast-shadow
      />
      <TresGroup :position="[-1, 0, 0]">
        <ModularRigTest :appearance="male" :armor="maleArmor" />
      </TresGroup>
      <TresGroup :position="[1, 0, 0]">
        <ModularRigTest :appearance="female" :armor="femaleArmor" />
      </TresGroup>
      <TresGridHelper :args="[10, 10]" />
    </TresCanvas>
  </div>
</template>
