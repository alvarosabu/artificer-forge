<script setup lang="ts">
const itemMenu = useItemContextMenu()
const menuGroups = itemMenu.menuGroups
const menuState = itemMenu.state
</script>

<template>
  <div
    v-if="menuState.open && menuGroups.length"
    class="fixed z-[60]"
    :style="{ left: `${menuState.x}px`, top: `${menuState.y}px` }"
  >
    <UDropdownMenu
      v-model:open="menuState.open"
      :items="menuGroups"
    >
      <template #default>
        <span class="sr-only">Item context menu trigger</span>
      </template>
    </UDropdownMenu>
  </div>
</template>
