const GROUP_ID = 'achievements'

/** Dev palette commands that lock and unlock achievements again, so their toasts show on demand. */
export function useAchievementCommands() {
  const { registerGroup, unregisterGroup, close } = useCommandPalette()
  const achievements = useAchievements()
  const ids = Object.keys(ACHIEVEMENTS) as AchievementId[]

  function replay(list: AchievementId[]) {
    list.forEach(achievements.lock)
    list.forEach(achievements.unlock)
    close()
  }

  registerGroup({
    id: GROUP_ID,
    label: 'Achievements',
    items: [
      ...ids.map(id => ({
        id: `achievement-${id}`,
        label: `Unlock: ${ACHIEVEMENTS[id].name}`,
        icon: 'i-lucide-trophy',
        onSelect: () => replay([id]),
      })),
      {
        id: 'achievement-all',
        label: 'Unlock: all achievements',
        icon: 'i-lucide-trophy',
        onSelect: () => replay(ids),
      },
    ],
  })

  onUnmounted(() => unregisterGroup(GROUP_ID))
}
