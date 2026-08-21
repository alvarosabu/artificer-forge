import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, Texture, Vector2 } from 'three'
import { uniform } from 'three/tsl'
import type { Node, UniformNode } from 'three/webgpu'

export interface ControlMapSettings {
    /** the image holding the channels: r = road, g = grass, b = water */
    texture: Texture
    /** world extent the map covers, width = depth, in metres */
    size: number
    /** world XZ centre of that square */
    origin?: [number, number]
    /** texture anisotropy; the ground is mostly seen at grazing angles, so > 1 pays off */
    anisotropy?: number
}

export interface ControlMapUniforms {
    origin: UniformNode<'vec2', Vector2>
    size: UniformNode<'float', number>
}

export interface ControlMap {
    texture: Texture
    uniforms: ControlMapUniforms
    size: number
    origin: Vector2
}
export function createControlMap({ texture, size, origin = [0, 0], anisotropy = 4 }: ControlMapSettings): ControlMap {
    texture.colorSpace = NoColorSpace
    texture.flipY = false
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping
    texture.magFilter = LinearFilter
    // mipmapped + anisotropic on purpose: unfiltered masks moire and crawl badly
    // at grazing angles. Distant mips blend the channels into mush, which fog
    // covers, and mush beats shimmer.
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = anisotropy
    texture.needsUpdate = true

    return {
        texture,
        size,
        origin: new Vector2(origin[0], origin[1]),
        uniforms: {
          origin: uniform(new Vector2(origin[0], origin[1])),
          size: uniform(size),
        },
      }
}

// shader-side world XZ → map uv. The CPU reader in stage 7 repeats this exactly.
export function controlUv(uniforms: ControlMapUniforms, worldXZ: Node<'vec2'>) {
    return worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
}