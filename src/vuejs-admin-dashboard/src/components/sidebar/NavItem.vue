<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  label: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  route: { type: Object, required: true },
})
</script>

<template>
  <RouterLink
    :to="route"
    class="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-on-surface-muted hover:text-on-surface hover:bg-surface-secondary transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    active-class="bg-primary-muted text-primary font-semibold"
    exact-active-class="bg-primary-muted text-primary font-semibold"
  >
    <component :is="icon" :size="18" class="shrink-0" aria-hidden="true" />
    <span>{{ label }}</span>
  </RouterLink>
</template>
