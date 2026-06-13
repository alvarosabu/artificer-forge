/** Ground surface elements. `ice` is a frozen STATE of water/blood, not its own kind. */
export type SurfaceKind = 'fire' | 'water' | 'oil' | 'poison' | 'blood'

/** Statuses a surface can inflict — a subset of the game's StatusEffectId, kept local
 *  so this module stays free of the Nuxt `~` alias (unavailable in node vitest). */
export type SurfaceStatusId = 'burning' | 'poisoned' | 'stunned' | 'wet' | 'slowed'

export interface SurfaceCell {
  kind: SurfaceKind | null
  /** 0..1 coverage/density — drives decay recede + shader intensity. */
  amount: number
  /** Seconds remaining once fully grown. Infinity while a source is still spreading. */
  lifetime: number
  /** 0..1 charge on a water/blood pool; decays fast; >0 ⇒ shocking. */
  electrified: number
  /** Water/blood frozen into ice. */
  frozen: boolean
}

/** A growing liquid puddle: fills a disc that expands to `targetRadius` then stops. */
export interface SurfaceSource {
    col: number
    row: number
    kind: SurfaceKind
    /** Current frontier radius in cells (grows by `speed*dt`). */
    radius: number
    /** Max radius in cells. */
    targetRadius: number
    /** Cells/second growth. */
    speed: number
    growing: boolean
}

export type SurfaceEvent = 'lightning' | 'cold'

export interface KindConfig {
  flammable: boolean
  liquid: boolean
  /** Seconds the surface persists after fully grown, before decay. */
  baseLifetime: number
  /** Default spread radius in cells when seeded. */
  defaultRadius: number
  /** Frontier growth speed (cells/sec). 0 ⇒ no spread (stamped instantly, e.g. fire). */
  spreadSpeed: number
}

export const KIND_CONFIG: Record<SurfaceKind, KindConfig> = {
  fire: { flammable: false, liquid: false, baseLifetime: 6, defaultRadius: 1, spreadSpeed: 0 },
  water: { flammable: false, liquid: true, baseLifetime: 20, defaultRadius: 3, spreadSpeed: 4 },
  oil: { flammable: true, liquid: true, baseLifetime: 30, defaultRadius: 2, spreadSpeed: 2 },
  poison: { flammable: true, liquid: true, baseLifetime: 18, defaultRadius: 2, spreadSpeed: 3 },
  blood: { flammable: false, liquid: true, baseLifetime: 25, defaultRadius: 2, spreadSpeed: 3 },
}

export function emptyCell(): SurfaceCell {
  return { kind: null, amount: 0, lifetime: 0, electrified: 0, frozen: false }
}

/** Numeric kind id for packing into texture channels (0 = none). */
export const KIND_ID: Record<SurfaceKind, number> = {
  fire: 1, water: 2, oil: 3, poison: 4, blood: 5,
}