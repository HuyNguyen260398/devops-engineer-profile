<script setup>
defineProps({
  title: { type: String, default: 'Nothing here yet' },
  description: { type: String, default: '' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div v-if="$slots.icon" class="mb-4 text-on-surface-subtle">
      <slot name="icon" />
    </div>
    <h3 class="text-base font-semibold text-on-surface mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-on-surface-muted mb-4 max-w-xs">{{ description }}</p>
    <div v-if="$slots.action">
      <slot name="action" />
    </div>
  </div>
</template>
