import { useTexture } from '@tresjs/cientos'
import { createHeightMap, readHeightPixels, sampleHeightAt } from '@artificer-forge/engine/runtime'
import type { HeightField, HeightMapMeta } from '@artificer-forge/engine/runtime'

/**
 * Loads a height field that the public-assets Vite plugin baked next to a terrain GLB.
 * `base` is the path without extension, for example `/models/levels/island-terrain.height-2048`.
 */
export function useHeightField(base: string) {
  const field = shallowRef<HeightField | null>(null)
  const meta = shallowRef<HeightMapMeta | null>(null)
  const { state: texture } = useTexture(`${base}.rgb.png`)

  $fetch<HeightMapMeta>(`${base}.json`).then((value) => { meta.value = value })

  watchEffect(() => {
    // useTexture holds a pixel-less Texture until the file lands
    if (field.value || !meta.value || !texture.value?.image) return
    // The json describes the 8-bit grey PNG. The rgb PNG has the same heights in 24 bits,
    // the grey one steps every few centimetres, which shows on slopes.
    field.value = createHeightMap({ texture: texture.value, meta: { ...meta.value, encoding: 'rgb' } })
  })

  /** Terrain height on the CPU, sampled the same way as the shader. Null until loaded. */
  function heightAt(x: number, z: number): number | null {
    if (!field.value) return null
    const pixels = readHeightPixels(field.value)
    return pixels ? sampleHeightAt(field.value, pixels, x, z) : null
  }

  return { field, heightAt }
}
