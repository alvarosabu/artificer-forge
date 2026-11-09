<template>
  <!-- Toasts are HUD: clicks pass through them to the game. -->
  <UApp :toaster="{ position: 'top-right', ui: { viewport: 'pointer-events-none', base: 'pointer-events-none' } }">
    <NuxtPage />
    <DevOnly>
      <DevCommandPalette />
    </DevOnly>
  </UApp>
</template>
