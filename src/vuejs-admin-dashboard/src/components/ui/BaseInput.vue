<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  helperText: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const inputId = `input-${Math.random().toString(36).slice(2, 9)}`
const errorId = `${inputId}-error`
const helperId = `${inputId}-helper`

const describedBy = computed(() => {
  const ids = []
  if (props.error) ids.push(errorId)
  else if (props.helperText) ids.push(helperId)
  return ids.join(' ') || undefined
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      v-if="label"
      :for="inputId"
      class="text-sm font-medium text-on-surface"
    >
      {{ label }}
      <span v-if="required" class="text-accent-red ml-0.5" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :aria-describedby="describedBy"
      :aria-invalid="!!error"
      class="w-full px-3 py-2 text-sm rounded-md bg-surface text-on-surface border placeholder:text-on-surface-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      :class="error ? 'border-accent-red' : 'border-border'"
      @input="emit('update:modelValue', $event.target.value)"
      @blur="emit('blur', $event)"
    />

    <p v-if="error" :id="errorId" class="text-xs text-accent-red">{{ error }}</p>
    <p v-else-if="helperText" :id="helperId" class="text-xs text-on-surface-muted">{{ helperText }}</p>
  </div>
</template>
