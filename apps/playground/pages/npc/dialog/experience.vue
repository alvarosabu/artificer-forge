<script setup lang="ts">
import { Floor, useSceneRefs } from '@artificer-forge/engine/runtime'
import { Vector3 } from 'three'
const gameStore = useGameStore()
const dialogStore = useDialogStore()
const { setCharacterRef, getCharacterRef } = useSceneRefs()
const { onAction } = useContextMenu()

const DIALOG_DISTANCE = 2.8

function startDialog(npcEntityId: string) {
  const npc = gameStore.getEntity(npcEntityId)
  const leaderId = gameStore.party.leader
  if (!npc || !leaderId || !npc.dialogId) return

  const leaderRef = getCharacterRef(leaderId)
  const leader = gameStore.getEntity(leaderId)
  if (!leaderRef || !leader) return

  const npcPos = new Vector3(npc.position.x, npc.position.y, npc.position.z)
  const leaderPos = new Vector3(leader.position.x, leader.position.y, leader.position.z)
  const direction = leaderPos.clone().sub(npcPos).normalize()
  const target = npcPos.clone().add(direction.multiplyScalar(DIALOG_DISTANCE))
  target.y = 0

  const { off } = leaderRef.onArrive(() => {
    // Face each other before the dialog opens.
    leaderRef.lookAt(npcPos)
    // Actor doesn't expose lookAt — rotate via the store; the entity rotation
    // reactively re-orients the rendered model.
    const dx = leaderPos.x - npcPos.x
    const dz = leaderPos.z - npcPos.z
    gameStore.updateEntity(npcEntityId, {
      rotation: { x: 0, y: Math.atan2(dx, dz), z: 0 },
    })
    dialogStore.open(npc.dialogId!, npcEntityId)
    off()
  })

  leaderRef.moveTo(target)
}

onAction((action, entityId) => {
  const entity = gameStore.getEntity(entityId)
  if (!entity) return
  if (action === 'talk' && entity.dialogId) {
    startDialog(entityId)
  }
})

useCommands({ entities: true, animations: true })

onMounted(async () => {
  const playerId = await gameStore.spawnFromTemplate('hero', { x: 0, y: 0, z: 0 })
  gameStore.addToParty(playerId)
  gameStore.selectEntity(playerId)

  const { spawnPoint } = await gameStore.loadScene('dialog_scene')
  gameStore.updateEntity(playerId, { position: spawnPoint })
})

const partyCharacters = computed(() => gameStore.partyEntities)
const actorEntities = computed(() => gameStore.actorEntities)
</script>

<template>
  <TresFog :args="['#020420', 12, 32]" />
  <TresAmbientLight :intensity="0.7" />
  <TresDirectionalLight
    :position="[5, 6, 4]"
    :intensity="1.6"
    cast-shadow
  />

  <Character
    v-for="entity in partyCharacters"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />
  <Actor
    v-for="entity in actorEntities"
    :ref="(el: any) => setCharacterRef(entity.id, el)"
    :key="entity.id"
    :entity-id="entity.id"
  />

  <DialogCameraDirector />
  <Floor />
</template>
