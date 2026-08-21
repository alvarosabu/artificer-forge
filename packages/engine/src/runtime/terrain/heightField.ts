import { Mesh } from 'three'
import {
    ClampToEdgeWrapping, HalfFloatType, LinearFilter, MeshBasicNodeMaterial,
    NoColorSpace, NoToneMapping, OrthographicCamera, RGBAFormat, RenderTarget,
    Scene, Vector2,
} from 'three/webgpu'
import type { BufferGeometry, Node, Texture, UniformNode, WebGPURenderer } from 'three/webgpu'
import { positionWorld, texture, uniform, vec2, vec4 } from 'three/tsl'

export interface HeightFieldSettings {
    /** the ground mesh geometry, with its node transform already baked in */
    geometry: BufferGeometry
    /** world extent the field covers, width = depth, in metres */
    size: number
    /** world XZ centre of that square */
    origin?: [number, number]
    /** texels per side; 512 over 60 metres is about 12 centimetres per texel */
    resolution?: number
}

export interface HeightFieldUniforms {
    origin: UniformNode<'vec2', Vector2>
    size: UniformNode<'float', number>
    /** world metres covered by one texel; stage 7 uses it as a sampling step */
    texelSize: UniformNode<'float', number>
}

export interface HeightField {
    texture: Texture
    uniforms: HeightFieldUniforms
    bake: (renderer: WebGPURenderer) => Promise<void>
    dispose: () => void
}

// No v flip, and that is WebGPU-specific. Its framebuffer origin is top-left, so
// NDC y = +1 is the FIRST texture row (v = 0). The bake camera's up is (0, 0, -1),
// which puts world +z at NDC y = -1, so world +z lands at v = 1 — the same way
// round as controlUv(). On a WebGL target this would need `local.y.oneMinus()`.
export function heightUv(uniforms: HeightFieldUniforms, worldXZ: Node<'vec2'>) {
    const local = worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
    return vec2(local.x, local.y)
}

export function sampleHeight(field: HeightField, worldXZ: Node<'vec2'>) {
    return texture(field.texture, heightUv(field.uniforms, worldXZ)).r
}

export function createHeightField({
    geometry, size, origin = [0, 0], resolution = 512,
}: HeightFieldSettings): HeightField {
    const target = new RenderTarget(resolution, resolution, {
        type: HalfFloatType,
        format: RGBAFormat,
        depthBuffer: true,
        generateMipmaps: false,
    })
    // raw numbers, not colour: any colour space conversion would corrupt the metres
    target.texture.colorSpace = NoColorSpace
    target.texture.minFilter = LinearFilter
    target.texture.magFilter = LinearFilter
    target.texture.wrapS = target.texture.wrapT = ClampToEdgeWrapping

    const material = new MeshBasicNodeMaterial()
    material.outputNode = vec4(positionWorld.y, 0, 0, 1)

    const bakeScene = new Scene()
    bakeScene.add(new Mesh(geometry, material))

    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    // one metre of slack at each end, so no triangle sits exactly on a clip plane
    const top = box.max.y + 1
    const bottom = box.min.y - 1

    const half = size / 2
    // near 0, far the full height range: the camera sits at `top` looking down, so
    // the frustum has to be deep enough to reach the lowest triangle
    const camera = new OrthographicCamera(-half, half, half, -half, 0, top - bottom)
    // looking straight down is degenerate with the default up vector of (0, 1, 0),
    // so pick an up vector that lies in the ground plane
    camera.up.set(0, 0, -1)
    camera.position.set(origin[0], top, origin[1])
    camera.lookAt(origin[0], bottom, origin[1])

    async function bake(renderer: WebGPURenderer) {
        const previousTarget = renderer.getRenderTarget()
        const previousToneMapping = renderer.toneMapping
        // tone mapping would curve the metres into a display range
        renderer.toneMapping = NoToneMapping
        renderer.setRenderTarget(target)
        await renderer.render(bakeScene, camera)
        renderer.setRenderTarget(previousTarget)
        renderer.toneMapping = previousToneMapping
    }

    return {
        texture: target.texture,
        uniforms: {
            origin: uniform(new Vector2(origin[0], origin[1])),
            size: uniform(size),
            texelSize: uniform(size / resolution),
        },
        bake,
        dispose: () => {
            target.dispose()
            material.dispose()
        },
    }
}