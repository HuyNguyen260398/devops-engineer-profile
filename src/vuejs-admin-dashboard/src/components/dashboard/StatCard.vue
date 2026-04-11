<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  icon: { type: [Object, Function], required: true },
  trend: { type: String, default: '' }, // e.g. "+12%" or ""
  iconClass: { type: String, default: 'text-primary' },
  iconBgClass: { type: String, default: 'bg-primary-muted' },
})
</script>

<template>
  <div class="bg-surface border border-border rounded-xl p-5 flex items-start gap-4">
    <div
      class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
      :class="iconBgClass"
    >
      <component :is="icon" :size="20" :class="iconClass" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <p class="text-sm text-on-surface-muted mb-0.5">{{ label }}</p>
      <p class="text-2xl font-semibold text-on-surface font-mono">{{ value }}</p>
      <p v-if="trend" class="text-xs text-on-surface-subtle mt-0.5">{{ trend }}</p>
    </div>
  </div>
</template>
