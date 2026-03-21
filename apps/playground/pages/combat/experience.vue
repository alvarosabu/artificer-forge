<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { Floor } from '@artificer-forge/components'
import { useSceneRefs } from '@artificer-forge/composables'

const gameStore = useGameStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()

const { register: registerEntities, unregister: unregisterEntities } = useEntityCommands()
const { register: registerStatusEffects, unregister: unregisterStatusEffects } = useStatusEffectCommands()
const { register: registerDamage, unregister: unregisterDamage } = useDamageNumberCommands(getCharacterRef)

onMounted(async () => {
  const heroId = await gameStore.spawnFromTemplate('hero', { x: -1.5, y: 0, z: 0 })
  gameStore.addToParty(heroId)
  gameStore.selectEntity(heroId)

  await gameStore.spawnFromTemplate('orc_scout', { x: 1.5, y: 0, z: 0 })

  registerEntities()
  registerStatusEffects()
  registerDamage()
})

onUnmounted(() => {
  unregisterEntities()
  unregisterStatusEffects()
  unregisterDamage()
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
  <TresPerspectiveCamera :position="[0, 5, 8]" :look-at="[0, 1, 0]" />
  <OrbitControls />
  <TresAmbientLight :intensity="0.8" />
  <TresDirectionalLight :position="[5, 5, 5]" :intensity="1.5" cast-shadow />
  <Character
    v-for="entity in characterEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Floor />
</template>
