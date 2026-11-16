export interface Speaker {
  /** The text on the dialog name tag. */
  name: string
}

/** Dialog speakers by the id their nodes use in `speaker`. */
export const SPEAKERS: Record<string, Speaker> = {
  robot_empanadas: { name: 'YU-L31-C' },
}

export function speakerName(id: string) {
  return SPEAKERS[id]?.name ?? id
}
