// App-injected modular part manifest (same pattern as content/loader injection:
// the engine never hardcodes asset paths). The app registers its generated
// manifest at startup; useModularRig resolves appearance part ids through it.

export interface ModularPartRef {
  /** Part id = filename stem = mesh node name. */
  id: string
  path: string
  /** Bodies only: key into manifest.rigs naming the skeleton this body binds to. */
  rig?: string
}

export interface ModularPartManifest {
  /** Bare-skeleton GLBs by rig key; 'medium' is the default when a body names none. */
  rigs: Record<string, string>
  /** Flat part list — slot grouping is a picker/UI concern, not the engine's. */
  parts: ModularPartRef[]
}

export const DEFAULT_RIG_KEY = 'medium'

let rigPaths: Record<string, string> = {}
const partPaths = new Map<string, string>()
const partRigs = new Map<string, string>()

export function registerPartManifest(manifest: ModularPartManifest) {
  rigPaths = { ...manifest.rigs }
  partPaths.clear()
  partRigs.clear()
  for (const part of manifest.parts) {
    partPaths.set(part.id, part.path)
    if (part.rig) partRigs.set(part.id, part.rig)
  }
}

export function resolvePartPath(id: string): string | undefined {
  return partPaths.get(id)
}

/** Rig key a body part binds to; DEFAULT_RIG_KEY when the part names none. */
export function resolvePartRig(id: string): string {
  return partRigs.get(id) ?? DEFAULT_RIG_KEY
}

export function manifestRigPath(rigKey: string = DEFAULT_RIG_KEY): string | null {
  return rigPaths[rigKey] ?? rigPaths[DEFAULT_RIG_KEY] ?? null
}
