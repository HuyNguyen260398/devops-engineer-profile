import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

export function useMotion() {
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const duration = computed(() => (prefersReduced.value ? '0ms' : '200ms'))
  return { prefersReduced, duration }
}
