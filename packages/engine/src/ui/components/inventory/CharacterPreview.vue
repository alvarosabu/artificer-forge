<script setup lang="ts">
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { useGameStore } from '@artificer-forge/engine/runtime'
import InventoryCharacterPreviewModel from './CharacterPreviewModel.vue'

const props = defineProps<{
  characterId: string
}>()

const gameStore = useGameStore()

const entity = computed(() => gameStore.getEntity(props.characterId))
const equipment = computed(() => gameStore.derivedEquipment(props.characterId))

const modelUrl = computed(() => entity.value?.model ?? null)
const rigKey = computed(() => entity.value?.rig ?? 'Rig_Medium')
</script>

<template>
  <div class="w-full h-full bg-marine-950/60 rounded">
    <TresCanvas
      v-if="modelUrl"
      :alpha="true"
      clear-color="#0a0a14"
      :antialias="true"
    >
      <TresPerspectiveCamera
        :position="[2, 1.3,8 ]"
        :look-at="[0, 1.2, 0]"
        :fov="35"
      />
      <TresAmbientLight :intensity="0.9" />
      <TresDirectionalLight
        :position="[3, 5, 3]"
        :intensity="1.5"
      />
      <Suspense>
        <InventoryCharacterPreviewModel
          :model-url="modelUrl"
          :rig-key="rigKey"
          :equipment="equipment"
        />
      </Suspense>
    </TresCanvas>
    <div
      v-else
      class="w-full h-full flex items-center justify-center text-marine-400 text-sm"
    >
      No model
    </div>
  </div>
</template>
