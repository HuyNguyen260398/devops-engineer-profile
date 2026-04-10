<script setup>
defineProps({
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  iconClass: { type: String, default: 'text-primary' },
  iconBgClass: { type: String, default: 'bg-primary-muted' },
  to: { type: [String, Object], required: true },
  badge: { type: String, default: '' },
})
</script>

<template>
  <RouterLink
    :to="to"
    class="group flex items-start gap-4 bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-card transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
  >
    <div
      class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
      :class="iconBgClass"
    >
      <component :is="icon" :size="20" :class="iconClass" aria-hidden="true" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
          {{ name }}
        </p>
        <span
          v-if="badge"
          class="text-xs font-medium text-on-surface-muted bg-surface-secondary border border-border rounded-full px-2 py-0.5 shrink-0"
        >
          {{ badge }}
        </span>
      </div>
      <p class="text-xs text-on-surface-muted mt-0.5">{{ description }}</p>
    </div>
  </RouterLink>
</template>
