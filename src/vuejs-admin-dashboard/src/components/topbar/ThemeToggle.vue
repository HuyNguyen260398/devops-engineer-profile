<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme.js'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    class="flex items-center justify-center w-9 h-9 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-secondary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    @click="toggle"
  >
    <Sun v-if="isDark" :size="18" aria-hidden="true" />
    <Moon v-else :size="18" aria-hidden="true" />
  </button>
</template>
