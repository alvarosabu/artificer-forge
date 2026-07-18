import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ONE shared DRACO-enabled GLTF loader for the whole app. cientos `useGLTF`
// news up a fresh DRACOLoader (worker pool + WASM heap) per call, so loading
// dozens of modular parts would spawn as many decoder instances and exhaust
// WASM memory. A single decoder + a per-path parse cache keeps it to one.
// Callers CLONE what they need — the cached GLTF must stay pristine.

let loader: GLTFLoader | null = null
const cache = new Map<string, Promise<GLTF>>()

function get(): GLTFLoader {
  if (loader) return loader
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
  draco.setWorkerLimit(2)
  loader = new GLTFLoader().setDRACOLoader(draco)
  return loader
}

/** Load (once) and cache a GLTF by path. The returned scene must not be mutated — clone it. */
export function loadGltf(path: string): Promise<GLTF> {
  let p = cache.get(path)
  if (!p) {
    p = get().loadAsync(path)
    cache.set(path, p)
  }
  return p
}
