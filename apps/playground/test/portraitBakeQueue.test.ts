import { describe, expect, it, vi } from 'vitest'
import { createBakeQueue } from '../utils/portraitBakeQueue'

function deferred() {
  let resolve!: (v: string) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createBakeQueue', () => {
  it('dedupes concurrent requests for the same key', async () => {
    const queue = createBakeQueue()
    const run = vi.fn(() => Promise.resolve('url'))
    const a = queue.request('k', run)
    const b = queue.request('k', run)
    expect(a).toBe(b)
    await a
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs different keys one at a time (serialized)', async () => {
    const queue = createBakeQueue()
    const order: string[] = []
    const first = deferred()

    const pa = queue.request('a', () => { order.push('a:start'); return first.promise.then((v) => { order.push('a:end'); return v }) })
    const pb = queue.request('b', () => { order.push('b:start'); return Promise.resolve('b') })

    // b must NOT start until a finishes
    await Promise.resolve()
    expect(order).toEqual(['a:start'])

    first.resolve('a')
    await Promise.all([pa, pb])
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('does not stall the queue when a bake fails', async () => {
    const queue = createBakeQueue()
    const pa = queue.request('a', () => Promise.reject(new Error('boom')))
    await expect(pa).rejects.toThrow('boom')
    const pb = queue.request('b', () => Promise.resolve('ok'))
    await expect(pb).resolves.toBe('ok')
  })
})
