<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme.js'

const { init } = useTheme()

onMounted(() => {
  init()
})
</script>

<template>
  <RouterView />
</template>
