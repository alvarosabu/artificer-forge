import { Texture } from 'three'
import { Mesh, type Material, type Group, type Object3D } from 'three'
import { useGraph, type TresObject3D } from '@tresjs/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { Equipment } from '~/stores/game'

type Slot = keyof Equipment

const BONE_NAMES: Record<Slot, string> = {
  mainHand: 'handslotr',
  offHand: 'handslotl',
}

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)

function disposeObject(obj: Group) {
  obj.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.geometry) {
      mesh.geometry.dispose()
    }
    if (mesh.material) {
      const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        // Dispose all texture maps on the material
        for (const value of Object.values(mat)) {
          if (value instanceof Texture) {
            value.dispose()
          }
        }
        mat.dispose()
      }
    }
  })
}

export function useEquipment(
  rig: Ref<TresObject3D | undefined>,
  equipment: Ref<Equipment | undefined>,
  activeSlot?: Ref<'mainHand' | 'offHand' | 'none' | undefined>,
) {
  const graph = useGraph(rig)

  const attached: Record<Slot, Group | null> = {
    mainHand: null,
    offHand: null,
  }

  // Per-slot request tracking to avoid race conditions
  const requestIds: Record<Slot, number> = { mainHand: 0, offHand: 0 }

  function getBone(slot: Slot) {
    return graph.value?.nodes?.[BONE_NAMES[slot]] ?? null
  }

  function detach(slot: Slot) {
    const obj = attached[slot]
    if (!obj) return

    obj.parent?.remove(obj)
    disposeObject(obj)
    attached[slot] = null
  }

  async function attach(slot: Slot, templateId: string) {
    const bone = getBone(slot)
    if (!bone) return

    const id = ++requestIds[slot]

    const template = await queryCollection('entities')
      .where('templateId', '=', templateId)
      .first()

    if (id !== requestIds[slot]) return
    if (!template?.model) return

    const gltf = await loader.loadAsync(template.model)

    if (id !== requestIds[slot]) return

    detach(slot)
    const scene = gltf.scene.clone()
    scene.traverse((child: Object3D) => {
      if(child instanceof Mesh) {
        child.castShadow = true
      }
    })
    bone.add(scene as unknown as TresObject3D)
    attached[slot] = scene
    applyVisibility()
  }

  function applyVisibility() {
    if (!activeSlot) return
    const active = activeSlot.value
    for (const slot of ['mainHand', 'offHand'] as Slot[]) {
      if (attached[slot]) {
        attached[slot]!.visible = active === 'none' ? false : (active == null || slot === active)
      }
    }
  }

  function syncSlot(slot: Slot, newId?: string, oldId?: string) {
    if (newId === oldId) return
    if (newId) attach(slot, newId)
    else detach(slot)
  }

  // When graph nodes become available, attach current equipment
  watch(() => graph.value?.nodes, (nodes) => {
    if (!nodes) return
    const eq = equipment.value
    if (eq?.mainHand) attach('mainHand', eq.mainHand)
    if (eq?.offHand) attach('offHand', eq.offHand)
  }, { immediate: true })

  // React to active weapon slot changes
  if (activeSlot) {
    watch(activeSlot, () => applyVisibility())
  }

  // React to equipment changes after bones are available
  watch(equipment, (newEq, oldEq) => {
    if (!graph.value?.nodes) return
    syncSlot('mainHand', newEq?.mainHand, oldEq?.mainHand)
    syncSlot('offHand', newEq?.offHand, oldEq?.offHand)
  }, { deep: true })

  onScopeDispose(() => {
    detach('mainHand')
    detach('offHand')
  })
}
