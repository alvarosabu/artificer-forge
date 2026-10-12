import { AdditiveBlending, Color, Object3D, Sprite, Vector4 } from 'three'
import { cos, float, floor, fract, hash, instanceIndex, mix, sin, smoothstep, time, uint, uniformArray, uv, vec3 } from 'three/tsl'
import { SpriteNodeMaterial } from 'three/webgpu'
import type { Node, UniformNode } from 'three/webgpu'
import { windOffset, type WindUniforms } from '../wind/wind'

export interface TorchEmberUniforms {
    emberSize: UniformNode<'float', number>
    emberRise: UniformNode<'float', number>
    emberDrift: UniformNode<'float', number>
    glowIntensity: UniformNode<'float', number>
    coreMid: UniformNode<'color', Color>
    coreHigh: UniformNode<'color', Color>
    rimHigh: UniformNode<'color', Color>
    wind: WindUniforms
}

const TAU = Math.PI * 2
// spawn band, in flame heights above the base
const SPAWN_LOW = 0.35
const SPAWN_HIGH = 0.85
const WOBBLE = 0.25
const FADE_IN = 0.08

/** Sparks that rise from every flame, cool from white to red and drift downwind. Shader-only, no CPU updates. */
export function createTorchEmbers(references: Object3D[], perTorch: number, width: number, uniforms: TorchEmberUniforms) {
    const torches = uniformArray(references.map(r => new Vector4(r.position.x, r.position.y, r.position.z, r.scale.y)), 'vec4')

    const i = instanceIndex.toFloat()
    const torch = torches.element(instanceIndex.div(uint(perTorch))) as unknown as Node<'vec4'>
    const height = torch.w

    const speed = mix(0.35, 0.8, hash(i.add(11)))
    const clock = time.mul(speed).add(hash(i.add(7)))
    const life = fract(clock)
    const seed = i.add(floor(clock).mul(97.13))

    const angle = hash(seed).mul(TAU)
    const radius = hash(seed.add(3)).sqrt().mul(width * 0.6)
    const spawnY = mix(SPAWN_LOW, SPAWN_HIGH, hash(seed.add(5)))

    // decelerates: the ember loses its lift as it cools
    const climb = float(1).sub(float(1).sub(life).pow(2))
    const wobbleRate = mix(3, 6, hash(seed.add(9)))
    const wobble = vec3(sin(time.mul(wobbleRate).add(angle)), 0, cos(time.mul(wobbleRate.mul(1.3)).add(angle))).mul(life.mul(WOBBLE))
    const wind = windOffset(uniforms.wind)(torch.xz) as unknown as Node<'vec2'>
    const drift = vec3(wind.x, 0, wind.y).mul(uniforms.emberDrift).mul(life)

    const local = vec3(cos(angle).mul(radius), spawnY.add(climb.mul(uniforms.emberRise)), sin(angle).mul(radius))
    const material = new SpriteNodeMaterial()
    material.transparent = true
    material.depthWrite = false
    material.blending = AdditiveBlending
    material.positionNode = torch.xyz.add(local.add(wobble).add(drift).mul(height))
    material.scaleNode = uniforms.emberSize.mul(mix(0.6, 1.4, hash(seed.add(13)))).mul(float(1).sub(life.mul(0.6)))

    const heat = float(1).sub(life)
    const cooling = mix(mix(uniforms.rimHigh, uniforms.coreMid, smoothstep(0, 0.5, heat)), uniforms.coreHigh, smoothstep(0.5, 1, heat))
    const twinkle = sin(time.mul(mix(12, 25, hash(i.add(17)))).add(angle)).mul(0.35).add(0.65)
    material.colorNode = cooling.mul(uniforms.glowIntensity).mul(twinkle)

    const disc = smoothstep(0.5, 0.1, uv().sub(0.5).length())
    const fade = smoothstep(0, FADE_IN, life).mul(smoothstep(1, 0.6, life))
    material.opacityNode = disc.mul(fade)

    const sprite = new Sprite(material)
    sprite.name = 'TorchEmbers'
    sprite.count = references.length * perTorch
    sprite.frustumCulled = false

    return { sprite, dispose: () => material.dispose() }
}
