import { type ComputedRef, onScopeDispose, shallowRef, watch } from 'vue'
import type { Mesh, Object3D } from 'three'
import {
  STATUS_OVERLAY_EFFECTS,
  STATUS_OVERLAY_BUILDERS,
  type StatusOverlayEffectId,
} from '@artificer-forge/vfx'
import type { StatusEffectId } from '@artificer-forge/engine/core'
import { useGameStore } from './stores/game'

const PRIORITY: StatusOverlayEffectId[] = ['burning', 'poisoned', 'frozen']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMaterial = Record<string, any>

export function useStatusEffectOverlay(
  rig: ComputedRef<Object3D | null | undefined>,
  entityId: ComputedRef<string>,
) {
  const gameStore = useGameStore()
  const originalNodes = new Map<Mesh, unknown>()
  const activeEffect = shallowRef<StatusOverlayEffectId | null>(null)

  function getMaterial(mesh: Mesh): AnyMaterial | null {
    const mat = mesh.material
    if (!mat) return null
    return (Array.isArray(mat) ? mat[0] : mat) as AnyMaterial
  }

  function applyOverlay(effectId: StatusOverlayEffectId) {
    clearOverlay()
    if (!rig.value) return
    const emissiveNode = STATUS_OVERLAY_BUILDERS[effectId](STATUS_OVERLAY_EFFECTS[effectId])
    rig.value.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const mat = getMaterial(mesh)
      if (!mat) return
      originalNodes.set(mesh, mat.emissiveNode ?? null)
      mat.emissiveNode = emissiveNode
      mat.needsUpdate = true
    })
    activeEffect.value = effectId
  }

  function clearOverlay() {
    originalNodes.forEach((node, mesh) => {
      const mat = getMaterial(mesh)
      if (!mat) return
      mat.emissiveNode = node ?? null
      mat.needsUpdate = true
    })
    originalNodes.clear()
    activeEffect.value = null
  }

  watch(
    () => ({
      effects: gameStore.getEntity(entityId.value)?.statusEffects,
      rigReady: !!rig.value,
    }),
    ({ effects }) => {
      const next = PRIORITY.find((e: StatusOverlayEffectId) => effects?.some((se: { id: StatusEffectId }) => se.id === e)) ?? null
      if (next) applyOverlay(next)
      else clearOverlay()
    },
    { deep: true },
  )

  onScopeDispose(clearOverlay)
}
