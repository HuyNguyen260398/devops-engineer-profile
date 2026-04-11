<script setup>
import { ref } from 'vue'
import { LayoutDashboard, BookOpen, FileCode, DollarSign, Server, X, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import NavItem from './NavItem.vue'

const props = defineProps({
  isMobileOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const isCollapsed = ref(false)

const navItems = [
  { label: 'Dashboard',          icon: LayoutDashboard, route: { name: 'dashboard' } },
  { label: 'Blog',               icon: BookOpen,        route: { name: 'blog-list' } },
  { label: 'HTML to Markdown',   icon: FileCode,        route: { name: 'html-to-markdown' } },
  { label: 'AWS Cost',           icon: DollarSign,      route: { name: 'aws-cost' } },
  { label: 'AWS Resources',      icon: Server,          route: { name: 'aws-resources' } },
]
</script>

<template>
  <!-- Desktop sidebar -->
  <aside
    :class="isCollapsed ? 'w-16' : 'w-64'"
    class="hidden lg:flex flex-col h-screen bg-surface border-r border-border shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
    aria-label="Sidebar navigation"
  >
    <!-- Logo / collapse toggle -->
    <div class="flex items-center h-14 border-b border-border shrink-0 px-2">
      <span
        v-if="!isCollapsed"
        class="flex-1 font-mono font-semibold text-on-surface text-base tracking-tight pl-2 truncate"
      >
        &lt;AdminHub /&gt;
      </span>
      <button
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :class="isCollapsed ? 'mx-auto' : 'ml-auto'"
        class="flex items-center justify-center w-8 h-8 rounded-md text-on-surface-muted hover:bg-surface-secondary hover:text-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none shrink-0"
        :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="isCollapsed = !isCollapsed"
      >
        <PanelLeftClose v-if="!isCollapsed" :size="18" />
        <PanelLeftOpen v-else :size="18" />
      </button>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 overflow-y-auto py-3 space-y-0.5" :class="isCollapsed ? 'px-1' : 'px-2'">
      <NavItem
        v-for="item in navItems"
        :key="item.label"
        :label="item.label"
        :icon="item.icon"
        :route="item.route"
        :collapsed="isCollapsed"
      />
    </nav>

    <!-- Footer -->
    <div
      :class="isCollapsed ? 'justify-center px-1' : 'px-4'"
      class="flex items-center py-3 border-t border-border text-xs text-on-surface-subtle font-mono"
    >
      <span v-if="!isCollapsed">v0.1.0</span>
      <span v-else title="v0.1.0">···</span>
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
          &lt;AdminHub/&gt;
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
