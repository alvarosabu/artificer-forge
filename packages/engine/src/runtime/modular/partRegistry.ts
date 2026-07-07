// App-injected modular part manifest (same pattern as content/loader injection:
// the engine never hardcodes asset paths). The app registers its generated
// manifest at startup; useModularRig resolves appearance part ids through it.

export interface ModularPartRef {
  /** Part id = filename stem = mesh node name. */
  id: string
  path: string
}

export interface ModularPartManifest {
  /** Canonical bare-skeleton GLB all parts rebind to (e.g. rig_medium.glb). */
  rig: string
  /** Flat part list — slot grouping is a picker/UI concern, not the engine's. */
  parts: ModularPartRef[]
}

let rigPath: string | null = null
const partPaths = new Map<string, string>()

export function registerPartManifest(manifest: ModularPartManifest) {
  rigPath = manifest.rig
  partPaths.clear()
  for (const part of manifest.parts) partPaths.set(part.id, part.path)
}

export function resolvePartPath(id: string): string | undefined {
  return partPaths.get(id)
}

export function manifestRigPath(): string | null {
  return rigPath
}
