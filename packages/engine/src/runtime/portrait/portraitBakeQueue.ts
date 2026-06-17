// Serializes portrait bakes (one renderer, one subject at a time) and dedupes
// concurrent requests for the same key so we never bake the same appearance twice.
export interface BakeQueue {
  request: (key: string, run: () => Promise<string>) => Promise<string>
}

export function createBakeQueue(): BakeQueue {
  const inFlight = new Map<string, Promise<string>>()
  let tail: Promise<unknown> = Promise.resolve()

  function request(key: string, run: () => Promise<string>): Promise<string> {
    const existing = inFlight.get(key)
    if (existing) return existing

    // Chain off the tail so only one bake runs at a time.
    const result = tail.then(() => run())
    // Advance the chain even on failure so the queue never stalls. This caught
    // branch also drives dedupe cleanup, so the cleanup never leaks an
    // unhandled rejection (the original `result` rejection is owned by the caller).
    tail = result.catch(() => {}).finally(() => {
      if (inFlight.get(key) === result) inFlight.delete(key)
    })
    inFlight.set(key, result)
    return result
  }

  return { request }
}
