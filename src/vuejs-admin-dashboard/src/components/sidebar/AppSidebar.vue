<script setup>
import { computed } from 'vue'
import { LayoutDashboard, BookOpen, X } from 'lucide-vue-next'
import NavItem from './NavItem.vue'

const props = defineProps({
  isMobileOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, route: { name: 'dashboard' } },
  { label: 'Blog', icon: BookOpen, route: { name: 'blog-list' } },
]
</script>

<template>
  <!-- Desktop sidebar -->
  <aside
    class="hidden lg:flex flex-col w-64 h-screen bg-surface border-r border-border shrink-0"
    aria-label="Sidebar navigation"
  >
    <!-- Logo / app name -->
    <div class="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
      <span class="font-mono font-semibold text-on-surface text-base tracking-tight">
        &lt;AdminHub /&gt;
      </span>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      <NavItem
        v-for="item in navItems"
        :key="item.label"
        :label="item.label"
        :icon="item.icon"
        :route="item.route"
      />
    </nav>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-border text-xs text-on-surface-subtle font-mono">
      v0.1.0
    </div>
  </aside>

  <!-- Mobile slide-out drawer -->
  <Transition
    enter-active-class="transition-transform duration-200 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="-translate-x-full"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="isMobileOpen"
      class="fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-surface border-r border-border lg:hidden"
      aria-label="Mobile navigation"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <span class="font-mono font-semibold text-on-surface text-base tracking-tight">
          &lt;AdminHub /&gt;
        </span>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-md text-on-surface-muted hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close navigation"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Nav items -->
      <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavItem
          v-for="item in navItems"
          :key="item.label"
          :label="item.label"
          :icon="item.icon"
          :route="item.route"
          @click="emit('close')"
        />
      </nav>

      <div class="px-4 py-3 border-t border-border text-xs text-on-surface-subtle font-mono">
        v0.1.0
      </div>
    </aside>
  </Transition>
</template>
