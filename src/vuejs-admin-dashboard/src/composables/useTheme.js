import { ref, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'

const STORAGE_KEY = 'theme'

// Singleton state shared across all composable consumers
const prefersDark = usePreferredDark()
const isDark = ref(false)

function init() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') {
    isDark.value = stored === 'dark'
  } else {
    isDark.value = prefersDark.value
  }
  applyClass()
}

function applyClass() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }
}

function toggle() {
  isDark.value = !isDark.value
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  applyClass()
}

export function useTheme() {
  return { isDark, toggle, init }
}
