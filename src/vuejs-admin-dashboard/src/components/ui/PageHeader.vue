<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 class="text-xl font-semibold text-on-surface">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 text-sm text-on-surface-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
