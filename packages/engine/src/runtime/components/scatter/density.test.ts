import { describe, expect, it } from 'vitest'
import { Texture } from 'three'
import { countAbove, createScatterBake, MASK_EPSILON } from './density'
import { createControlMap, sampleControlChannel, setControlPixels, type ControlMap, type ControlMapPixels } from '../../terrain/controlMap'

/**
 * The bake replaces a vertex-stage test, so the two have to agree. These lock the
 * pieces the shader cannot be asked about in node: the prefix invariant (for any
 * threshold, the drawn prefix is exactly the passing set), the `step` tie rule,
 * and the sampler's bilinear + clamp behaviour.
 */

/** rgba image from a per-texel grass value, row-major from the top */
function grassImage(width: number, height: number, grass: (x: number, y: number) => number): ControlMapPixels {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            data[i + 1] = Math.round(grass(x, y) * 255)
            data[i + 3] = 255
        }
    }
    return { data, width, height }
}

function mapWith(pixels: ControlMapPixels, size: number, origin: [number, number] = [0, 0]): ControlMap {
    const map = createControlMap({ texture: new Texture(), size, origin })
    setControlPixels(map, pixels)
    return map
}

function smoothstep(low: number, high: number, x: number) {
    const t = Math.min(1, Math.max(0, (x - low) / (high - low)))
    return t * t * (3 - 2 * t)
}

describe('countAbove', () => {
    const coverage = new Float32Array([0.9, 0.7, 0.5, 0.3])

    it('counts the leading run at or above the threshold', () => {
        expect(countAbove(coverage, 0.95)).toBe(0)
        expect(countAbove(coverage, 0.8)).toBe(1)
        expect(countAbove(coverage, 0.4)).toBe(3)
        expect(countAbove(coverage, 0)).toBe(4)
    })

    // step(edge, x) is 1 when x === edge, so an exact tie has to be drawn
    it('includes an exact tie, the way step does', () => {
        expect(countAbove(coverage, 0.5)).toBe(3)
        expect(countAbove(coverage, 0.9)).toBe(1)
    })

    it('handles an all-equal array', () => {
        const flat = new Float32Array([0.5, 0.5, 0.5])
        expect(countAbove(flat, 0.5)).toBe(3)
        expect(countAbove(flat, 0.6)).toBe(0)
    })
})

describe('sampleControlChannel', () => {
    // 2x2, grass ramping left (0) to right (1); world x spans [-1, 1]
    const pixels = grassImage(2, 2, x => x)
    const map = mapWith(pixels, 2)
    const g = (x: number, z: number) => sampleControlChannel(map, pixels, x, z, 1)

    it('reads texel centres exactly', () => {
        // u = 0.25 lands on the centre of texel 0, u = 0.75 on texel 1
        expect(g(-0.5, 0)).toBeCloseTo(0, 5)
        expect(g(0.5, 0)).toBeCloseTo(1, 5)
    })

    it('interpolates between them', () => {
        expect(g(0, 0)).toBeCloseTo(0.5, 5)
    })

    it('clamps to the edge outside the map', () => {
        expect(g(-1, 0)).toBeCloseTo(0, 5)
        expect(g(1, 0)).toBeCloseTo(1, 5)
        expect(g(-50, 0)).toBeCloseTo(0, 5)
        expect(g(50, 0)).toBeCloseTo(1, 5)
    })

    it('follows the map origin', () => {
        const shifted = mapWith(pixels, 2, [10, 0])
        expect(sampleControlChannel(shifted, pixels, 9.5, 0, 1)).toBeCloseTo(0, 5)
        expect(sampleControlChannel(shifted, pixels, 10.5, 0, 1)).toBeCloseTo(1, 5)
    })

    it('reads row 0 at v = 0, because the map does not flip Y', () => {
        // top row all grass, bottom row none. World -z is the top row.
        const rows = grassImage(2, 2, (_x, y) => (y === 0 ? 1 : 0))
        const rowMap = mapWith(rows, 2)
        expect(sampleControlChannel(rowMap, rows, 0, -0.5, 1)).toBeCloseTo(1, 5)
        expect(sampleControlChannel(rowMap, rows, 0, 0.5, 1)).toBeCloseTo(0, 5)
    })
})

describe('createScatterBake', () => {
    const SIZE = 8
    const COUNT = 64
    const MASK_LOW = 0.25
    const MASK_HIGH = 0.6
    const JITTER = 0.25

    /** an 8x8 grid of anchors with deterministic noise */
    function field() {
        const anchors = new Float32Array(COUNT * 2)
        const instanceData = new Float32Array(COUNT * 4)
        const densityNoises = new Float32Array(COUNT)
        const randoms = new Float32Array(COUNT)
        for (let i = 0; i < COUNT; i++) {
            const iX = i >> 3
            const iZ = i & 7
            anchors[i * 2] = (iX + 0.5) / 8 * SIZE - SIZE / 2
            anchors[i * 2 + 1] = (iZ + 0.5) / 8 * SIZE - SIZE / 2
            instanceData[i * 4] = randoms[i] = ((i * 37) % 100) / 100
            instanceData[i * 4 + 1] = i
            instanceData[i * 4 + 2] = 1
            instanceData[i * 4 + 3] = 0.5
            densityNoises[i] = ((i * 61) % 100) / 100
        }
        return { anchors, instanceData, densityNoises, randoms }
    }

    /** the flowers/tufts shape: patch noise mixed with white noise, times the mask */
    function withNoise(f: ReturnType<typeof field>, control?: ControlMap | null) {
        return {
            count: COUNT,
            anchors: f.anchors,
            attributes: [{ array: f.instanceData, stride: 4 }],
            noise: { densityNoises: f.densityNoises, randoms: f.randoms },
            control,
            maskLow: MASK_LOW,
            maskHigh: MASK_HIGH,
        }
    }

    // grass everywhere on the +x half, bare on the -x half
    const pixels = grassImage(16, 16, x => (x >= 8 ? 1 : 0))

    it('declines without a control map', () => {
        const f = field()
        const bake = createScatterBake(withNoise(f))
        expect(bake.coverage).toBeNull()
        // the shader keeps the test, so every instance stays in the draw
        expect(bake.countFor(0.5)).toBe(COUNT)
        expect(bake.rebake(0.1, 0.2)).toBe(false)
    })

    it('declines when a densityMap it cannot read is in play', () => {
        const f = field()
        const bake = createScatterBake({ ...withNoise(f, mapWith(pixels, SIZE)), densityMap: new Texture() })
        expect(bake.coverage).toBeNull()
    })

    it('sorts coverage descending', () => {
        const f = field()
        const bake = createScatterBake(withNoise(f, mapWith(pixels, SIZE)))
        const coverage = bake.coverage!
        expect(coverage).toHaveLength(COUNT)
        for (let i = 1; i < COUNT; i++) expect(coverage[i]).toBeLessThanOrEqual(coverage[i - 1])
    })

    it('draws exactly the instances the coverage formula passes', () => {
        const raw = field()
        const srcAnchors = raw.anchors.slice()
        const control = mapWith(pixels, SIZE)

        // the oracle: coverage per instance, computed straight from the formula
        const expected = new Map<string, number>()
        for (let i = 0; i < COUNT; i++) {
            const x = srcAnchors[i * 2]
            const z = srcAnchors[i * 2 + 1]
            const mask = smoothstep(MASK_LOW, MASK_HIGH, sampleControlChannel(control, pixels, x, z, 1))
            const noise = raw.densityNoises[i]
            const random = ((i * 37) % 100) / 100
            // fround: the bake stores coverage in a Float32Array, and countAbove
            // compares in float32, so the oracle has to round the same way
            expected.set(`${x},${z}`, Math.fround((noise + (random - noise) * JITTER) * mask))
        }

        const bake = createScatterBake(withNoise(raw, control))

        for (const threshold of [0, 0.1, 0.3, 0.45, 0.5, 0.66, 0.9, 1]) {
            const drawn = new Set<string>()
            for (let i = 0; i < bake.countFor(threshold); i++)
                drawn.add(`${raw.anchors[i * 2]},${raw.anchors[i * 2 + 1]}`)

            const shouldDraw = new Set(
                [...expected.entries()].filter(([, c]) => c >= Math.fround(threshold)).map(([key]) => key),
            )
            expect(drawn, `threshold ${threshold}`).toEqual(shouldDraw)
        }
    })

    it('keeps each instance\'s own data with its anchor through the sort', () => {
        const raw = field()
        const srcAnchors = raw.anchors.slice()
        const srcInstance = raw.instanceData.slice()
        // yaw is the instance index, so it identifies the source row
        const byAnchor = new Map<string, Float32Array>()
        for (let i = 0; i < COUNT; i++)
            byAnchor.set(`${srcAnchors[i * 2]},${srcAnchors[i * 2 + 1]}`, srcInstance.slice(i * 4, i * 4 + 4))

        createScatterBake(withNoise(raw, mapWith(pixels, SIZE)))

        for (let i = 0; i < COUNT; i++) {
            const key = `${raw.anchors[i * 2]},${raw.anchors[i * 2 + 1]}`
            expect([...raw.instanceData.slice(i * 4, i * 4 + 4)], key).toEqual([...byAnchor.get(key)!])
        }
    })

    it('drops the bare half to zero coverage', () => {
        const raw = field()
        const bake = createScatterBake(withNoise(raw, mapWith(pixels, SIZE)))
        // half the grid sits on bare ground, so half the coverage values are 0
        const zeroes = [...bake.coverage!].filter(c => c === 0).length
        expect(zeroes).toBe(COUNT / 2)
        // and every drawn instance at a positive threshold is on the grass side
        for (let i = 0; i < bake.countFor(0.01); i++) expect(raw.anchors[i * 2]).toBeGreaterThan(0)
    })

    it('re-sorts for a new mask band', () => {
        const raw = field()
        const bake = createScatterBake(withNoise(raw, mapWith(pixels, SIZE)))
        const before = bake.countFor(0.3)

        // a band the bare half now clears: every instance gets a full mask
        expect(bake.rebake(-1, -0.5)).toBe(true)
        expect(bake.countFor(0.3)).toBeGreaterThan(before)
        for (let i = 1; i < COUNT; i++)
            expect(bake.coverage![i]).toBeLessThanOrEqual(bake.coverage![i - 1])
    })

    // grass.ts passes no `noise`: its coverage IS the control mask
    describe('mask-only coverage (the grass path)', () => {
        it('uses the mask as the coverage value', () => {
            const raw = field()
            const control = mapWith(pixels, SIZE)
            const srcAnchors = raw.anchors.slice()
            const bake = createScatterBake({
                count: COUNT,
                anchors: raw.anchors,
                attributes: [{ array: raw.randoms, stride: 1 }, { array: raw.densityNoises, stride: 1 }],
                control,
                maskLow: MASK_LOW,
                maskHigh: MASK_HIGH,
            })
            const coverage = bake.coverage!
            for (let i = 0; i < COUNT; i++) {
                const expected = smoothstep(MASK_LOW, MASK_HIGH, sampleControlChannel(
                    control, pixels, raw.anchors[i * 2], raw.anchors[i * 2 + 1], 1,
                ))
                expect(coverage[i]).toBeCloseTo(expected, 6)
            }
            // and it is still a permutation of the same anchors
            const before = new Set<string>()
            for (let i = 0; i < COUNT; i++) before.add(`${srcAnchors[i * 2]},${srcAnchors[i * 2 + 1]}`)
            const after = new Set<string>()
            for (let i = 0; i < COUNT; i++) after.add(`${raw.anchors[i * 2]},${raw.anchors[i * 2 + 1]}`)
            expect(after).toEqual(before)
        })

        it('cuts exactly the dead half at MASK_EPSILON', () => {
            const raw = field()
            const bake = createScatterBake({
                count: COUNT,
                anchors: raw.anchors,
                attributes: [{ array: raw.randoms, stride: 1 }],
                control: mapWith(pixels, SIZE),
                maskLow: MASK_LOW,
                maskHigh: MASK_HIGH,
            })
            const drawn = bake.countFor(MASK_EPSILON)
            expect(drawn).toBe(COUNT / 2)
            // every blade kept is on the grass side, every one dropped is not
            for (let i = 0; i < drawn; i++) expect(raw.anchors[i * 2]).toBeGreaterThan(0)
            for (let i = drawn; i < COUNT; i++) expect(raw.anchors[i * 2]).toBeLessThan(0)
        })

        it('keeps single-stride attributes with their anchor', () => {
            const raw = field()
            const srcAnchors = raw.anchors.slice()
            const srcRandoms = raw.randoms.slice()
            const pairs = new Map<string, number>()
            for (let i = 0; i < COUNT; i++) pairs.set(`${srcAnchors[i * 2]},${srcAnchors[i * 2 + 1]}`, srcRandoms[i])

            createScatterBake({
                count: COUNT,
                anchors: raw.anchors,
                attributes: [{ array: raw.randoms, stride: 1 }],
                control: mapWith(pixels, SIZE),
                maskLow: MASK_LOW,
                maskHigh: MASK_HIGH,
            })

            for (let i = 0; i < COUNT; i++) {
                const key = `${raw.anchors[i * 2]},${raw.anchors[i * 2 + 1]}`
                expect(raw.randoms[i], key).toBe(pairs.get(key))
            }
        })
    })
})
