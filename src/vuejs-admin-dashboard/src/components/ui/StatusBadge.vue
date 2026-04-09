<script setup>
import { computed } from 'vue'
import { CircleDot, CheckCircle2 } from 'lucide-vue-next'

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (v) => ['draft', 'published'].includes(v),
  },
})

const config = computed(() => {
  if (props.status === 'published') {
    return {
      label: 'Published',
      icon: CheckCircle2,
      classes: 'bg-accent-green-muted text-accent-green border border-accent-green/30',
    }
  }
  return {
    label: 'Draft',
    icon: CircleDot,
    classes: 'bg-accent-yellow-muted text-accent-yellow border border-accent-yellow/30',
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono"
    :class="config.classes"
  >
    <component :is="config.icon" :size="11" aria-hidden="true" />
    {{ config.label }}
  </span>
</template>
