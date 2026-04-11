<script setup>
import { useRoute } from 'vue-router'
import { Menu } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'

const emit = defineEmits(['open-drawer'])
const route = useRoute()

const titleMap = {
  dashboard: 'Dashboard',
  'blog-list': 'Blog',
  'blog-new': 'New Post',
  'blog-detail': 'Post Detail',
  'blog-edit': 'Edit Post',
}
</script>

<template>
  <header
    class="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-surface border-b border-border shrink-0"
    role="banner"
  >
    <!-- Left: hamburger (mobile) + page title -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        aria-label="Open navigation menu"
        class="flex lg:hidden items-center justify-center w-9 h-9 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-secondary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        @click="emit('open-drawer')"
      >
        <Menu :size="20" aria-hidden="true" />
      </button>
      <span class="text-sm font-semibold text-on-surface">
        {{ titleMap[route.name] ?? 'Admin Dashboard' }}
      </span>
    </div>

    <!-- Right: theme toggle + avatar placeholder -->
    <div class="flex items-center gap-2">
      <ThemeToggle />
      <!-- User avatar placeholder -->
      <div
        class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold font-mono select-none"
        aria-label="User avatar"
      >
        AD
      </div>
    </div>
  </header>
</template>
