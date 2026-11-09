<script setup lang="ts">
defineProps<{ name: 'signal' | 'wifi' | 'battery' }>()

const WIFI_CENTER = { x: 9, y: 12.5 }

function wifiArc(radius: number) {
  const d = radius * Math.SQRT1_2
  const { x, y } = WIFI_CENTER
  return `M${x - d},${y - d}A${radius},${radius} 0 0 1 ${x + d},${y - d}`
}
</script>

<template>
  <svg
    v-if="name === 'signal'"
    viewBox="0 0 19 14"
    width="19"
    height="14"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="0" y="9" width="3.6" height="5" rx="1.4" />
    <rect x="5.1" y="6.3" width="3.6" height="7.7" rx="1.4" />
    <rect x="10.2" y="3.4" width="3.6" height="10.6" rx="1.4" />
    <rect x="15.3" y="0" width="3.6" height="14" rx="1.4" />
  </svg>

  <svg
    v-else-if="name === 'wifi'"
    viewBox="0 0 18 14"
    width="18"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path :d="wifiArc(10)" />
    <path :d="wifiArc(5.6)" />
    <circle
      :cx="WIFI_CENTER.x"
      :cy="WIFI_CENTER.y - 1.2"
      r="1.9"
      fill="currentColor"
      stroke="none"
    />
  </svg>

  <svg
    v-else
    viewBox="0 0 29 14"
    width="29"
    height="14"
    aria-hidden="true"
  >
    <rect
      x="1.1"
      y="1.1"
      width="23.4"
      height="11.8"
      rx="4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <rect x="3.9" y="3.9" width="17.8" height="6.2" rx="2" fill="var(--color-accent)" />
    <rect x="25.8" y="4.5" width="2.6" height="5" rx="1.3" fill="currentColor" />
  </svg>
</template>
