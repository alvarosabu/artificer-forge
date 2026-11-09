import seaPolluterIcon from '~/assets/svg/achievements/sea-polluter.svg'

export interface Achievement {
  name: string
  icon: string
}

export const ACHIEVEMENTS = {
  seaPolluter: { name: 'Polluter of the Sea', icon: seaPolluterIcon },
} satisfies Record<string, Achievement>

export type AchievementId = keyof typeof ACHIEVEMENTS
