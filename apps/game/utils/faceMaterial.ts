import type { MeshStandardMaterial } from 'three'
import { cameraWorldMatrix, normalMap, normalWorld, texture, uniform, uv, vec4 } from 'three/tsl'
import { MeshLambertNodeMaterial, Vector2 } from 'three/webgpu'
import { createDropShadowCatcher, stylizedOutput } from '@artificer-forge/engine/runtime'
import type { GradingContext } from '@artificer-forge/engine/runtime'
import type { Node } from 'three/webgpu'

export interface AtlasGrid {
    columns: number
    rows: number
  }

/** A graded material that shows the atlas of a face mesh. */
export function createFaceMaterial(source: MeshStandardMaterial,  grid: AtlasGrid, grading: GradingContext,) {
  const cellOffset = uniform(new Vector2(0, 0))
  const cellUv = uv().add(cellOffset)
  const color = texture(source.map!, cellUv)
    let normal = normalWorld
  const material = new MeshLambertNodeMaterial()
  material.transparent = true
  material.depthWrite = false
  const dropShadow = createDropShadowCatcher()
  material.receivedShadowNode = dropShadow.receivedShadowNode

  if (source.normalMap) {
    const viewNormal = normalMap(texture(source.normalMap, cellUv)) as unknown as Node<'vec3'>
    normal = viewNormal.transformDirection(cameraWorldMatrix)
  }
  material.outputNode = stylizedOutput(color.rgb, grading, {
    normalNode: normal,
    alphaNode: color.a,
    dropShadowNode: dropShadow.shadowFactor,
    hasMidTone: true,
    hasRim: true,
    hasSpecular: true,
  })

  function showCell(cell: number) {
    cellOffset.value.set((cell % grid.columns) / grid.columns, Math.floor(cell / grid.columns) / grid.rows)
  }

  return { material, showCell }
}

export type FaceMaterial = ReturnType<typeof createFaceMaterial>