import type { CommandGroup } from './useCommandPalette'
import { AnimationName, type AnimationNameType } from '@artificer-forge/engine/runtime'
const ANIMATION_CATEGORIES: Record<string, { label: string, animations: AnimationNameType[] }> = {
  'movement-basic': {
    label: 'Movement Basic',
    animations: [
      AnimationName.JUMP_FULL_LONG, AnimationName.JUMP_FULL_SHORT, AnimationName.JUMP_IDLE,
      AnimationName.JUMP_LAND, AnimationName.JUMP_START, AnimationName.RUNNING_A,
      AnimationName.RUNNING_B, AnimationName.T_POSE, AnimationName.WALKING_A,
      AnimationName.WALKING_B, AnimationName.WALKING_C,
    ],
  },
  'movement-advanced': {
    label: 'Movement Advanced',
    animations: [
      AnimationName.CRAWLING, AnimationName.CROUCHING, AnimationName.DODGE_BACKWARD,
      AnimationName.DODGE_FORWARD, AnimationName.DODGE_LEFT, AnimationName.DODGE_RIGHT,
      AnimationName.RUNNING_HOLDING_BOW, AnimationName.RUNNING_HOLDING_RIFLE,
      AnimationName.RUNNING_STRAFE_LEFT, AnimationName.RUNNING_STRAFE_RIGHT,
      AnimationName.SNEAKING, AnimationName.WALKING_BACKWARDS,
    ],
  },
  'general': {
    label: 'General',
    animations: [
      AnimationName.DEATH_A, AnimationName.DEATH_A_POSE, AnimationName.DEATH_B,
      AnimationName.DEATH_B_POSE, AnimationName.HIT_A, AnimationName.HIT_B,
      AnimationName.IDLE_A, AnimationName.IDLE_B, AnimationName.INTERACT,
      AnimationName.PICK_UP, AnimationName.SPAWN_AIR, AnimationName.SPAWN_GROUND,
      AnimationName.THROW, AnimationName.USE_ITEM,
    ],
  },
  'combat-melee': {
    label: 'Combat Melee',
    animations: [
      AnimationName.MELEE_1H_ATTACK_CHOP, AnimationName.MELEE_1H_ATTACK_JUMP_CHOP,
      AnimationName.MELEE_1H_ATTACK_SLICE_DIAGONAL, AnimationName.MELEE_1H_ATTACK_SLICE_HORIZONTAL,
      AnimationName.MELEE_1H_ATTACK_STAB, AnimationName.MELEE_2H_ATTACK_CHOP,
      AnimationName.MELEE_2H_ATTACK_SLICE, AnimationName.MELEE_2H_ATTACK_SPIN,
      AnimationName.MELEE_2H_ATTACK_SPINNING, AnimationName.MELEE_2H_ATTACK_STAB,
      AnimationName.MELEE_2H_IDLE, AnimationName.MELEE_BLOCK, AnimationName.MELEE_BLOCK_ATTACK,
      AnimationName.MELEE_BLOCK_HIT, AnimationName.MELEE_BLOCKING,
      AnimationName.MELEE_DUALWIELD_ATTACK_CHOP, AnimationName.MELEE_DUALWIELD_ATTACK_SLICE,
      AnimationName.MELEE_DUALWIELD_ATTACK_STAB, AnimationName.MELEE_UNARMED_ATTACK_KICK,
      AnimationName.MELEE_UNARMED_ATTACK_PUNCH_A, AnimationName.MELEE_UNARMED_IDLE,
    ],
  },
  'combat-ranged': {
    label: 'Combat Ranged',
    animations: [
      AnimationName.RANGED_1H_AIMING, AnimationName.RANGED_1H_RELOAD, AnimationName.RANGED_1H_SHOOT,
      AnimationName.RANGED_1H_SHOOTING, AnimationName.RANGED_2H_AIMING, AnimationName.RANGED_2H_RELOAD,
      AnimationName.RANGED_2H_SHOOT, AnimationName.RANGED_2H_SHOOTING,
      AnimationName.RANGED_BOW_AIMING_IDLE, AnimationName.RANGED_BOW_DRAW,
      AnimationName.RANGED_BOW_DRAW_UP, AnimationName.RANGED_BOW_IDLE,
      AnimationName.RANGED_BOW_RELEASE, AnimationName.RANGED_BOW_RELEASE_UP,
      AnimationName.RANGED_MAGIC_RAISE, AnimationName.RANGED_MAGIC_SHOOT,
      AnimationName.RANGED_MAGIC_SPELLCASTING, AnimationName.RANGED_MAGIC_SPELLCASTING_LONG,
      AnimationName.RANGED_MAGIC_SUMMON,
    ],
  },
  'simulation': {
    label: 'Simulation',
    animations: [
      AnimationName.CHEERING, AnimationName.LIE_DOWN, AnimationName.LIE_IDLE,
      AnimationName.LIE_STAND_UP, AnimationName.PUSH_UPS, AnimationName.SIT_CHAIR_DOWN,
      AnimationName.SIT_CHAIR_IDLE, AnimationName.SIT_CHAIR_STAND_UP,
      AnimationName.SIT_FLOOR_DOWN, AnimationName.SIT_FLOOR_IDLE,
      AnimationName.SIT_FLOOR_STAND_UP, AnimationName.SIT_UPS, AnimationName.WAVING,
    ],
  },
  'tools': {
    label: 'Tools',
    animations: [
      AnimationName.CHOP, AnimationName.CHOPPING, AnimationName.DIG, AnimationName.DIGGING,
      AnimationName.FISHING_BITE, AnimationName.FISHING_CAST, AnimationName.FISHING_CATCH,
      AnimationName.FISHING_IDLE, AnimationName.FISHING_REELING, AnimationName.FISHING_STRUGGLING,
      AnimationName.FISHING_TUG, AnimationName.HAMMER, AnimationName.HAMMERING,
      AnimationName.HOLDING_A, AnimationName.HOLDING_B, AnimationName.HOLDING_C,
      AnimationName.LOCKPICK, AnimationName.LOCKPICKING, AnimationName.PICKAXE,
      AnimationName.PICKAXING, AnimationName.SAW, AnimationName.SAWING,
      AnimationName.WORK_A, AnimationName.WORK_B, AnimationName.WORK_C,
      AnimationName.WORKING_A, AnimationName.WORKING_B, AnimationName.WORKING_C,
    ],
  },
  'special': {
    label: 'Special (Skeletons)',
    animations: [
      AnimationName.EXPERIMENTAL_MEDIUM_TRANSFORM, AnimationName.SKELETONS_AWAKEN_FLOOR,
      AnimationName.SKELETONS_AWAKEN_FLOOR_LONG, AnimationName.SKELETONS_AWAKEN_STANDING,
      AnimationName.SKELETONS_DEATH, AnimationName.SKELETONS_DEATH_POSE,
      AnimationName.SKELETONS_DEATH_RESURRECT, AnimationName.SKELETONS_IDLE,
      AnimationName.SKELETONS_INACTIVE_FLOOR_POSE, AnimationName.SKELETONS_INACTIVE_STANDING_POSE,
      AnimationName.SKELETONS_SPAWN_GROUND, AnimationName.SKELETONS_TAUNT,
      AnimationName.SKELETONS_TAUNT_LONGER, AnimationName.SKELETONS_WALKING,
    ],
  },
}

interface CharacterRef {
  play: (name: string) => void
}

export function useAnimationCommands(
  characterRef: Ref<CharacterRef | null>,
  onSelect?: () => void,
) {
  const { registerGroup, unregisterGroup } = useCommandPalette()

  function buildGroups(): CommandGroup[] {
    return Object.entries(ANIMATION_CATEGORIES).map(([id, { label, animations }]) => ({
      id: `anim-${id}`,
      label: `Animations: ${label}`,
      items: animations.map(anim => ({
        id: anim,
        label: anim.replace(/_/g, ' '),
        icon: 'i-heroicons-play',
        onSelect: () => {
          characterRef.value?.play(anim)
          onSelect?.()
        },
      })),
    }))
  }

  function register() {
    buildGroups().forEach(registerGroup)
  }

  function unregister() {
    Object.keys(ANIMATION_CATEGORIES).forEach(id => unregisterGroup(`anim-${id}`))
  }

  return {
    register,
    unregister,
  }
}
