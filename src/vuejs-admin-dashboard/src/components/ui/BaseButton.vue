<script setup>
import LoadingSpinner from './LoadingSpinner.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
})

const variantClasses = {
  primary:
    'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary border border-transparent',
  secondary:
    'bg-surface text-on-surface border border-border hover:bg-surface-secondary focus-visible:ring-primary',
  ghost:
    'bg-transparent text-on-surface-muted hover:text-on-surface hover:bg-surface-secondary border border-transparent focus-visible:ring-primary',
  danger:
    'bg-accent-red text-white hover:opacity-90 border border-transparent focus-visible:ring-accent-red',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
  md: 'px-4 py-2 text-sm gap-2 min-h-[36px]',
  lg: 'px-5 py-2.5 text-base gap-2 min-h-[44px]',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    :class="[variantClasses[variant], sizeClasses[size]]"
  >
    <LoadingSpinner v-if="loading" :size="size === 'sm' ? 14 : 16" class="shrink-0" />
    <slot v-else-if="$slots.icon" name="icon" />
    <slot />
  </button>
</template>
