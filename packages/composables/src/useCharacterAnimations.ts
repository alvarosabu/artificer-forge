import { computed, ref, shallowRef, unref, watch, readonly, type DeepReadonly, type MaybeRef, type Ref, type ShallowRef } from 'vue'
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { LoopOnce, type AnimationAction, type Object3D } from 'three'

export const AnimationName = {
  // MovementBasic
  JUMP_FULL_LONG: 'Jump_Full_Long',
  JUMP_FULL_SHORT: 'Jump_Full_Short',
  JUMP_IDLE: 'Jump_Idle',
  JUMP_LAND: 'Jump_Land',
  JUMP_START: 'Jump_Start',
  RUNNING_A: 'Running_A',
  RUNNING_B: 'Running_B',
  T_POSE: 'T-Pose',
  WALKING_A: 'Walking_A',
  WALKING_B: 'Walking_B',
  WALKING_C: 'Walking_C',

  // MovementAdvanced
  CRAWLING: 'Crawling',
  CROUCHING: 'Crouching',
  DODGE_BACKWARD: 'Dodge_Backward',
  DODGE_FORWARD: 'Dodge_Forward',
  DODGE_LEFT: 'Dodge_Left',
  DODGE_RIGHT: 'Dodge_Right',
  RUNNING_HOLDING_BOW: 'Running_HoldingBow',
  RUNNING_HOLDING_RIFLE: 'Running_HoldingRifle',
  RUNNING_STRAFE_LEFT: 'Running_Strafe_Left',
  RUNNING_STRAFE_RIGHT: 'Running_Strafe_Right',
  SNEAKING: 'Sneaking',
  WALKING_BACKWARDS: 'Walking_Backwards',

  // General
  DEATH_A: 'Death_A',
  DEATH_A_POSE: 'Death_A_Pose',
  DEATH_B: 'Death_B',
  DEATH_B_POSE: 'Death_B_Pose',
  HIT_A: 'Hit_A',
  HIT_B: 'Hit_B',
  IDLE_A: 'Idle_A',
  IDLE_B: 'Idle_B',
  INTERACT: 'Interact',
  PICK_UP: 'PickUp',
  SPAWN_AIR: 'Spawn_Air',
  SPAWN_GROUND: 'Spawn_Ground',
  THROW: 'Throw',
  USE_ITEM: 'Use_Item',

  // CombatMelee
  MELEE_1H_ATTACK_CHOP: 'Melee_1H_Attack_Chop',
  MELEE_1H_ATTACK_JUMP_CHOP: 'Melee_1H_Attack_Jump_Chop',
  MELEE_1H_ATTACK_SLICE_DIAGONAL: 'Melee_1H_Attack_Slice_Diagonal',
  MELEE_1H_ATTACK_SLICE_HORIZONTAL: 'Melee_1H_Attack_Slice_Horizontal',
  MELEE_1H_ATTACK_STAB: 'Melee_1H_Attack_Stab',
  MELEE_2H_ATTACK_CHOP: 'Melee_2H_Attack_Chop',
  MELEE_2H_ATTACK_SLICE: 'Melee_2H_Attack_Slice',
  MELEE_2H_ATTACK_SPIN: 'Melee_2H_Attack_Spin',
  MELEE_2H_ATTACK_SPINNING: 'Melee_2H_Attack_Spinning',
  MELEE_2H_ATTACK_STAB: 'Melee_2H_Attack_Stab',
  MELEE_2H_IDLE: 'Melee_2H_Idle',
  MELEE_BLOCK: 'Melee_Block',
  MELEE_BLOCK_ATTACK: 'Melee_Block_Attack',
  MELEE_BLOCK_HIT: 'Melee_Block_Hit',
  MELEE_BLOCKING: 'Melee_Blocking',
  MELEE_DUALWIELD_ATTACK_CHOP: 'Melee_Dualwield_Attack_Chop',
  MELEE_DUALWIELD_ATTACK_SLICE: 'Melee_Dualwield_Attack_Slice',
  MELEE_DUALWIELD_ATTACK_STAB: 'Melee_Dualwield_Attack_Stab',
  MELEE_UNARMED_ATTACK_KICK: 'Melee_Unarmed_Attack_Kick',
  MELEE_UNARMED_ATTACK_PUNCH_A: 'Melee_Unarmed_Attack_Punch_A',
  MELEE_UNARMED_IDLE: 'Melee_Unarmed_Idle',

  // CombatRanged
  RANGED_1H_AIMING: 'Ranged_1H_Aiming',
  RANGED_1H_RELOAD: 'Ranged_1H_Reload',
  RANGED_1H_SHOOT: 'Ranged_1H_Shoot',
  RANGED_1H_SHOOTING: 'Ranged_1H_Shooting',
  RANGED_2H_AIMING: 'Ranged_2H_Aiming',
  RANGED_2H_RELOAD: 'Ranged_2H_Reload',
  RANGED_2H_SHOOT: 'Ranged_2H_Shoot',
  RANGED_2H_SHOOTING: 'Ranged_2H_Shooting',
  RANGED_BOW_AIMING_IDLE: 'Ranged_Bow_Aiming_Idle',
  RANGED_BOW_DRAW: 'Ranged_Bow_Draw',
  RANGED_BOW_DRAW_UP: 'Ranged_Bow_Draw_Up',
  RANGED_BOW_IDLE: 'Ranged_Bow_Idle',
  RANGED_BOW_RELEASE: 'Ranged_Bow_Release',
  RANGED_BOW_RELEASE_UP: 'Ranged_Bow_Release_Up',
  RANGED_MAGIC_RAISE: 'Ranged_Magic_Raise',
  RANGED_MAGIC_SHOOT: 'Ranged_Magic_Shoot',
  RANGED_MAGIC_SPELLCASTING: 'Ranged_Magic_Spellcasting',
  RANGED_MAGIC_SPELLCASTING_LONG: 'Ranged_Magic_Spellcasting_Long',
  RANGED_MAGIC_SUMMON: 'Ranged_Magic_Summon',

  // Simulation
  CHEERING: 'Cheering',
  LIE_DOWN: 'Lie_Down',
  LIE_IDLE: 'Lie_Idle',
  LIE_STAND_UP: 'Lie_StandUp',
  PUSH_UPS: 'Push_Ups',
  SIT_CHAIR_DOWN: 'Sit_Chair_Down',
  SIT_CHAIR_IDLE: 'Sit_Chair_Idle',
  SIT_CHAIR_STAND_UP: 'Sit_Chair_StandUp',
  SIT_FLOOR_DOWN: 'Sit_Floor_Down',
  SIT_FLOOR_IDLE: 'Sit_Floor_Idle',
  SIT_FLOOR_STAND_UP: 'Sit_Floor_StandUp',
  SIT_UPS: 'Sit_Ups',
  WAVING: 'Waving',

  // Tools
  CHOP: 'Chop',
  CHOPPING: 'Chopping',
  DIG: 'Dig',
  DIGGING: 'Digging',
  FISHING_BITE: 'Fishing_Bite',
  FISHING_CAST: 'Fishing_Cast',
  FISHING_CATCH: 'Fishing_Catch',
  FISHING_IDLE: 'Fishing_Idle',
  FISHING_REELING: 'Fishing_Reeling',
  FISHING_STRUGGLING: 'Fishing_Struggling',
  FISHING_TUG: 'Fishing_Tug',
  HAMMER: 'Hammer',
  HAMMERING: 'Hammering',
  HOLDING_A: 'Holding_A',
  HOLDING_B: 'Holding_B',
  HOLDING_C: 'Holding_C',
  LOCKPICK: 'Lockpick',
  LOCKPICKING: 'Lockpicking',
  PICKAXE: 'Pickaxe',
  PICKAXING: 'Pickaxing',
  SAW: 'Saw',
  SAWING: 'Sawing',
  WORK_A: 'Work_A',
  WORK_B: 'Work_B',
  WORK_C: 'Work_C',
  WORKING_A: 'Working_A',
  WORKING_B: 'Working_B',
  WORKING_C: 'Working_C',

  // Special (Skeletons)
  EXPERIMENTAL_MEDIUM_TRANSFORM: 'EXPERIMENTAL_Medium_Transform',
  SKELETONS_AWAKEN_FLOOR: 'Skeletons_Awaken_Floor',
  SKELETONS_AWAKEN_FLOOR_LONG: 'Skeletons_Awaken_Floor_Long',
  SKELETONS_AWAKEN_STANDING: 'Skeletons_Awaken_Standing',
  SKELETONS_DEATH: 'Skeletons_Death',
  SKELETONS_DEATH_POSE: 'Skeletons_Death_Pose',
  SKELETONS_DEATH_RESURRECT: 'Skeletons_Death_Resurrect',
  SKELETONS_IDLE: 'Skeletons_Idle',
  SKELETONS_INACTIVE_FLOOR_POSE: 'Skeletons_Inactive_Floor_Pose',
  SKELETONS_INACTIVE_STANDING_POSE: 'Skeletons_Inactive_Standing_Pose',
  SKELETONS_SPAWN_GROUND: 'Skeletons_Spawn_Ground',
  SKELETONS_TAUNT: 'Skeletons_Taunt',
  SKELETONS_TAUNT_LONGER: 'Skeletons_Taunt_Longer',
  SKELETONS_WALKING: 'Skeletons_Walking',
} as const

export type AnimationNameType = typeof AnimationName[keyof typeof AnimationName]

export interface PlayOptions {
  fadeTime?: number
  timeScale?: number
  once?: boolean
}

export type RigSize = 'Medium' | 'Large'

const ANIM_PACKS = [
  'MovementBasic',
  'MovementAdvanced',
  'General',
  'CombatMelee',
  'CombatRanged',
  'Simulation',
  'Tools',
  'Special',
] as const

export function useCharacterAnimations(
  rig: MaybeRef<Object3D | undefined>,
  rigSize: RigSize = 'Medium',
) {
  const animBase = `/models/animations/Rig_${rigSize}/Rig_${rigSize}_`

  const animStates = ANIM_PACKS.map(pack => useGLTF(`${animBase}${pack}.glb`).state)

  // Raw animations from all packs
  const rawAnimations = computed(() =>
    animStates.flatMap(state => state.value?.animations || []),
  )

  // Only provide animations to useAnimations when rig is ready
  const safeAnimations = computed(() => {
    if (!unref(rig)) return []
    return rawAnimations.value
  })

  const { actions } = useAnimations(safeAnimations, rig)

  const currentAction = shallowRef<AnimationAction | null>(null)
  const currentAnimName = ref<AnimationNameType>(AnimationName.IDLE_A)


  function play(name: AnimationNameType, fadeTimeOrOpts: number | PlayOptions = 0.3, timeScale = 1) {
    const opts = typeof fadeTimeOrOpts === 'number'
      ? { fadeTime: fadeTimeOrOpts, timeScale, once: false }
      : { fadeTime: 0.3, timeScale: 1, once: false, ...fadeTimeOrOpts }

    const newAction = actions[name]
    if (!newAction) return

    // Already playing this animation - just update timeScale if needed
    if (currentAction.value === newAction) {
      newAction.setEffectiveTimeScale(opts.timeScale!)
      return
    }

    // Reset clears finished/paused state from previous LoopOnce plays
    newAction.reset()
    newAction.setEffectiveTimeScale(opts.timeScale!)
    newAction.setEffectiveWeight(1)

    if (opts.once) {
      newAction.setLoop(LoopOnce, 1)
      newAction.clampWhenFinished = true
    }
    else {
      newAction.clampWhenFinished = false
    }

    newAction.play()

    // Fade out old action if exists
    if (currentAction.value) {
      currentAction.value.fadeOut(opts.fadeTime!)
    }

    currentAction.value = newAction
    currentAnimName.value = name
  }

  function stop(fadeTime = 0.3) {
    if (currentAction.value) {
      currentAction.value.fadeOut(fadeTime)
      currentAction.value = null
    }
  }

  // When actions are recreated (new animation pack loaded), restore current animation
  watch(
    () => Object.keys(actions).length,
    (len) => {
      if (len === 0) return
      if (currentAction.value && actions[currentAnimName.value] && actions[currentAnimName.value] !== currentAction.value) {
        // Actions were recreated — current action is orphaned, restore it
        const wasOnce = currentAction.value.loop === LoopOnce
        currentAction.value = null
        play(currentAnimName.value, { fadeTime: 0, once: wasOnce })
      }
      else if (!currentAction.value) {
        play(AnimationName.IDLE_A, 0)
      }
    },
    { immediate: true },
  )

  return {
    actions: actions as Readonly<Record<string, AnimationAction | null>>,
    currentAction: readonly(currentAction) as Readonly<ShallowRef<AnimationAction | null>>,
    currentAnimName: readonly(currentAnimName) as DeepReadonly<Ref<AnimationNameType>>,
    play,
    stop,
  }
}
