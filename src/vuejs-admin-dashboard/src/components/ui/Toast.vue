<script setup>
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast.js'

const { toasts, remove } = useToast()

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const styleMap = {
  success: 'border-accent-green/40 bg-surface',
  error: 'border-accent-red/40 bg-surface',
  info: 'border-border bg-surface',
  warning: 'border-accent-yellow/40 bg-surface',
}

const iconStyleMap = {
  success: 'text-accent-green',
  error: 'text-accent-red',
  info: 'text-primary',
  warning: 'text-accent-yellow',
}
</script>

<template>
  <div
    aria-live="polite"
    aria-atomic="false"
    class="fixed bottom-4 right-4 sm:right-4 sm:bottom-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:max-w-sm"
  >
    <TransitionGroup
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in absolute"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="flex items-start gap-3 p-3.5 rounded-lg border shadow-card text-sm"
        :class="styleMap[toast.type] ?? styleMap.info"
        role="alert"
      >
        <component
          :is="iconMap[toast.type] ?? Info"
          :size="16"
          class="shrink-0 mt-0.5"
          :class="iconStyleMap[toast.type] ?? iconStyleMap.info"
          aria-hidden="true"
        />
        <span class="flex-1 text-on-surface">{{ toast.message }}</span>
        <button
          type="button"
          :aria-label="`Dismiss notification: ${toast.message}`"
          class="text-on-surface-muted hover:text-on-surface shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          @click="remove(toast.id)"
        >
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
