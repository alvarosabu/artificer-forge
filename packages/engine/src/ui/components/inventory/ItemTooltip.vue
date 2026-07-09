<script setup lang="ts">
import type { EntityState } from '@artificer-forge/engine/runtime'

const props = defineProps<{
  item: EntityState
}>()
</script>

<template>
  <div class="relative min-w-56 max-w-96 bg-marine-900 border border-gold-600/60 rounded-md p-3 pr-32 text-sm text-gold-100 shadow-xl">
    <img
      v-if="props.item.icon"
      :src="props.item.icon"
      :alt="props.item.name"
      class="absolute -top-8 -right-4 w-32 h-32 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] pointer-events-none select-none [mask-image:linear-gradient(to_bottom,black_50%,transparent)]"
      draggable="false"
    />
    <div class="font-serif text-base text-gold-200 mb-1">{{ props.item.name }}</div>
    <div class="text-xs text-gold-400/80 capitalize mb-2">{{ props.item.subtype ?? 'item' }}</div>

    <div v-if="props.item.damage" class="text-xs mb-1">
      <span class="text-gold-300">Damage:</span> {{ props.item.damage.dice }} {{ props.item.damage.type }}
    </div>
    <div v-if="props.item.effect" class="text-xs mb-1">
      <span class="text-gold-300">Effect:</span> {{ props.item.effect.type }}
      <span v-if="props.item.effect.dice">({{ props.item.effect.dice }})</span>
    </div>
    <div class="text-xs mb-1">
      <span class="text-gold-300">Weight:</span> {{ (props.item.weight ?? 0).toFixed(1) }} kg
    </div>
    <div v-if="props.item.value !== undefined" class="text-xs mb-1">
      <span class="text-gold-300">Value:</span> {{ props.item.value }}
    </div>

    <div v-if="props.item.properties?.length" class="flex flex-wrap gap-1 mt-2">
      <span
        v-for="p in props.item.properties"
        :key="p"
        class="text-[10px] px-1.5 py-0.5 bg-leather-800/80 border border-leather-700 rounded text-gold-200/80"
      >
        {{ p }}
      </span>
    </div>
  </div>
</template>
