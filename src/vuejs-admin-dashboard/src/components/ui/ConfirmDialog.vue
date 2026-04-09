<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: 'This action cannot be undone.' },
  confirmLabel: { type: String, default: 'Delete' },
  cancelLabel: { type: String, default: 'Cancel' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const dialogRef = ref(null)
const cancelBtnRef = ref(null)

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function confirm() {
  emit('confirm')
}

function onKeydown(e) {
  if (!props.modelValue) return
  if (e.key === 'Escape') close()
  if (e.key === 'Tab') trapFocus(e)
}

function trapFocus(e) {
  if (!dialogRef.value) return
  const focusable = dialogRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      await nextTick()
      cancelBtnRef.value?.$el?.focus?.() ?? cancelBtnRef.value?.focus?.()
    }
  }
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      leave-active-class="transition-opacity duration-100 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        aria-modal="true"
        role="dialog"
        :aria-label="title"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          class="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl p-6"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-accent-red-subtle shrink-0">
                <AlertTriangle :size="20" class="text-accent-red" aria-hidden="true" />
              </div>
              <h2 class="text-base font-semibold text-on-surface">{{ title }}</h2>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              class="text-on-surface-muted hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
              @click="close"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Message -->
          <p class="text-sm text-on-surface-muted mb-6">{{ message }}</p>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3">
            <BaseButton
              ref="cancelBtnRef"
              variant="secondary"
              @click="close"
            >
              {{ cancelLabel }}
            </BaseButton>
            <BaseButton
              variant="danger"
              :loading="loading"
              @click="confirm"
            >
              {{ confirmLabel }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
