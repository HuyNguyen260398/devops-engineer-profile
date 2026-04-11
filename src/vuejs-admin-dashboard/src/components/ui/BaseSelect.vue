<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  options: {
    type: Array,
    default: () => [],
    // [{ value: string, label: string }]
  },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const selectId = `select-${Math.random().toString(36).slice(2, 9)}`
const errorId = `${selectId}-error`
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="selectId" class="text-sm font-medium text-on-surface">
      {{ label }}
      <span v-if="required" class="text-accent-red ml-0.5" aria-hidden="true">*</span>
    </label>

    <select
      :id="selectId"
      :value="modelValue"
      :required="required"
      :disabled="disabled"
      :aria-describedby="error ? errorId : undefined"
      :aria-invalid="!!error"
      class="w-full px-3 py-2 text-sm rounded-md bg-surface text-on-surface border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
      :class="error ? 'border-accent-red' : 'border-border'"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <slot>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </slot>
    </select>

    <p v-if="error" :id="errorId" class="text-xs text-accent-red">{{ error }}</p>
  </div>
</template>
