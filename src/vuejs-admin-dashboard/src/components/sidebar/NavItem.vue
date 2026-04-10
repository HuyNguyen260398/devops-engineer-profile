<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  label: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  route: { type: Object, required: true },
  collapsed: { type: Boolean, default: false },
})
</script>

<template>
  <RouterLink
    :to="route"
    :title="collapsed ? label : undefined"
    :class="collapsed ? 'justify-center px-0' : 'gap-3 px-3'"
    class="flex items-center py-2.5 rounded-md text-sm font-medium text-on-surface-muted hover:text-on-surface hover:bg-surface-secondary transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    active-class="bg-primary-muted text-primary font-semibold"
    exact-active-class="bg-primary-muted text-primary font-semibold"
  >
    <component :is="icon" :size="18" class="shrink-0" aria-hidden="true" />
    <span v-if="!collapsed">{{ label }}</span>
  </RouterLink>
</template>
