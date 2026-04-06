<script setup lang="ts">
useHead({
  title: 'TresJS Playground',
})

interface DemoLink {
  label: string
  to: string
  disabled?: boolean
}

interface DemoCategory {
  title: string
  icon: string
  links: DemoLink[]
}

const categories: DemoCategory[] = [
  {
    title: 'Character',
    icon: 'i-heroicons-user',
    links: [
      { label: 'Basic', to: '/character/basic' },
      { label: 'Large', to: '/character/large' },
    ],
  },
  {
    title: 'Interactable',
    icon: 'i-heroicons-cube',
    links: [
      { label: 'Chest', to: '/interactable/chest' },
    ],
  },
  {
    title: 'NPC',
    icon: 'i-heroicons-user-group',
    links: [
      { label: 'Basic', to: '/npc/basic' },
    ],
  },
  {
    title: 'Shaders',
    icon: 'i-heroicons-sparkles',
    links: [
      { label: 'Basic', to: '/shaders/basic' },
    ],
  },
  {
    title: 'Combat',
    icon: 'i-heroicons-bolt',
    links: [
      { label: 'Damage Numbers', to: '/combat/damage-numbers' },
      { label: 'Attack', to: '/combat/attack' },
      { label: 'Ranged Attacks', to: '/combat/ranged' },
    ],
  },
  {
    title: 'Environment',
    icon: 'i-heroicons-',
    links: [
      { label: 'Foliage', to: '/environment/foliage' },
    ],
  },
]
</script>

<template>
  <UContainer class="py-12">
    <div class="flex items-start justify-between mb-12">
      <div>
        <h1 class="text-5xl font-bold">
          <span class="text-primary">Core</span>
          <br>
          <span class="text-gray-900 dark:text-white">Playground</span>
        </h1>
        <p class="mt-4 text-lg text-gray-500 dark:text-gray-400">
          Testing zone for core features
        </p>
      </div>
      <div class="bg-gray-800 dark:bg-gray-700 rounded-2xl p-4">
        <UIcon name="i-heroicons-face-smile" class="w-16 h-16 text-white" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <UCard v-for="category in categories" :key="category.title">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
              <UIcon :name="category.icon" class="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
            <h2 class="font-semibold text-lg">{{ category.title }}</h2>
          </div>
        </template>

        <ul class="space-y-1">
          <li v-for="link in category.links" :key="link.label">
            <ULink
              :to="link.disabled ? undefined : link.to"
              :class="[
                'text-sm block py-0.5',
                link.disabled
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary'
              ]"
            >
              {{ link.label }}
            </ULink>
          </li>
        </ul>
      </UCard>
    </div>
  </UContainer>
</template>
