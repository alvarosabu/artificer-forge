import { Vector2 } from 'three'
import { mod, uniform, vec2 } from 'three/tsl'
import type { Node, UniformNode } from 'three/webgpu'

/**
 * Moving centre for the scatter fields — Bruno's looping-grid trick.
 *
 * Grass, tufts and flowers are grids of a FIXED instance count. Spread over the
 * whole level that count buys almost nothing per square metre; spread over the
 * area around the character it buys a lawn. So the grids stay small and the
 * whole field rides along with whoever the camera is watching.
 *
 * One focus is shared by every field in a scene: a single uniform write per
 * frame moves them all.
 */
export interface ScatterFocus {
    center: UniformNode<'vec2', Vector2>
    /**
     * Where the edge fade starts, as a fraction of the half-window. Lives here
     * rather than on each field because it is a property of the window, and
     * because a uniform is tunable live — a per-field number would be baked into
     * the node graph and need a rebuild to move.
     */
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

/**
 * A static grid anchor → the copy of it that falls inside the window around the
 * focus.
 *
 * `mod` makes this world = anchor - size * floor((anchor - center + half) / size),
 * so the result is always the anchor plus a WHOLE number of field widths. An
 * instance therefore never slides as the focus moves: it stays on its lattice
 * point until the window leaves it behind, then teleports one full field width
 * ahead. Whatever teleports is behind the far edge, so nothing on screen jumps.
 *
 * The price is that every baked per-instance value (patch noise, colour noise)
 * repeats with period `size`. Only one period is ever on screen at a time, so it
 * reads as variation rather than tiling.
 */
export function followAnchor(focus: ScatterFocus, anchor: Node<'vec2'>, size: number) {
    const half = size * 0.5
    const local = anchor.sub(focus.center)
    return vec2(
        mod(local.x.add(half), size).sub(half).add(focus.center.x),
        mod(local.y.add(half), size).sub(half).add(focus.center.y),
    )
}

/**
 * 1 through the middle of the window, ramping to 0 at its edge.
 *
 * Without it the wrap boundary is a hard line where full-height plants pop in
 * and out as the character walks. Chebyshev distance, not radial: the window is
 * a square, so fading to the square's own edge wastes no instances in the
 * corners the way a circle would.
 */
export function followFade(focus: ScatterFocus, worldXZ: Node<'vec2'>, size: number) {
    const local = worldXZ.sub(focus.center).abs()
    const edge = local.x.max(local.y).div(size * 0.5)
    return edge.smoothstep(focus.fadeStart, 1).oneMinus()
}

/**
 * The exact complement of `followFade`: 0 inside a window of `size`, 1 outside it,
 * ramping across the same band.
 *
 * This is what makes a detail RING seamless. A near field of `size` fades out at
 * its own edge; a far field multiplies this in for the same `size`, so across the
 * band the two weights sum to 1 and the lawn keeps one continuous height. Give
 * both rings the same blades per square metre and there is no seam to find — only
 * the triangles per blade change.
 */
export function followFadeIn(focus: ScatterFocus, worldXZ: Node<'vec2'>, size: number) {
    return followFade(focus, worldXZ, size).oneMinus()
}
