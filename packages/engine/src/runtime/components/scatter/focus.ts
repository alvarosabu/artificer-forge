import { Vector2 } from 'three'
import { mod, uniform, vec2 } from 'three/tsl'
import type { Node, UniformNode } from 'three/webgpu'

// Moving centre for the scatter fields (Bruno's looping-grid trick): the grids have a fixed
// instance count, so they stay small and ride along with the camera target. One focus per scene.
export interface ScatterFocus {
    center: UniformNode<'vec2', Vector2>
    /** fraction of the half-window where the edge fade starts. A uniform, not a per-field number, so it moves without a node-graph rebuild */
    fadeStart: UniformNode<'float', number>
    set: (x: number, z: number) => void
    setFadeStart: (value: number) => void
}

export interface ScatterFocusSettings {
    x?: number
    z?: number
    fadeStart?: number
}

export function createScatterFocus(settings: ScatterFocusSettings = {}): ScatterFocus {
    const { x = 0, z = 0, fadeStart = 0.85 } = settings
    const center = uniform(new Vector2(x, z))
    const fade = uniform(fadeStart)
    return {
        center,
        fadeStart: fade,
        set: (nx, nz) => center.value.set(nx, nz),
        setFadeStart: (value) => { fade.value = value },
    }
}

// The result is always anchor + a whole number of field widths, so an instance never slides:
// it teleports a full width ahead, behind the far edge. Baked per-instance values repeat with period `size`.
export function followAnchor(focus: ScatterFocus, anchor: Node<'vec2'>, size: number) {
    const half = size * 0.5
    const local = anchor.sub(focus.center)
    return vec2(
        mod(local.x.add(half), size).sub(half).add(focus.center.x),
        mod(local.y.add(half), size).sub(half).add(focus.center.y),
    )
}

// Hides the wrap boundary. Chebyshev distance, not radial: the window is a square,
// so fading to its own edge wastes no corner instances.
export function followFade(focus: ScatterFocus, worldXZ: Node<'vec2'>, size: number) {
    const local = worldXZ.sub(focus.center).abs()
    const edge = local.x.max(local.y).div(size * 0.5)
    return edge.smoothstep(focus.fadeStart, 1).oneMinus()
}

// Exact complement of followFade: a far field fades in over the band the near field fades
// out, so the weights sum to 1 and a detail ring has no seam.
export function followFadeIn(focus: ScatterFocus, worldXZ: Node<'vec2'>, size: number) {
    return followFade(focus, worldXZ, size).oneMinus()
}
