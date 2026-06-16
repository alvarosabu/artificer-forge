<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { TargetReticle } from '@artificer-forge/vfx'
import { Character, Floor, useGameStore, useSceneRefs } from '@artificer-forge/engine/runtime'
const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()

useCommands({ entities: true, statusEffects: true, damageNumbers: true })

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: -1.5, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  await gameStore.spawnFromTemplate('orc_scout', { x: 1.5, y: 0, z: 0 })
})

const characterEntities = computed(() =>
  [...gameStore.entities.values()].filter(e => e.type === 'character'),
)

const DAMAGE_TYPES = ['physical', 'magical', 'fire', 'ice', 'lightning', 'poison'] as const

onKeyDown('d', () => {
  const orc = [...gameStore.entities.values()].find(e => e.templateId === 'orc_scout')
  if (!orc) return
  const type = DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)]!
  const amount = Math.floor(Math.random() * 80) + 5
  const critical = Math.random() < 0.2
  getCharacterRef(orc.id)?.showDamage(amount, type, critical)
})
</script>

<template>
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <TargetReticle
    :position="[0, 0.01, 0]"
    :color="'#ff0000'"
    :radius="0.8"
    :visible="true"
  />
  <Floor />
</template>
