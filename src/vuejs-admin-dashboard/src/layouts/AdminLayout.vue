<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@components/sidebar/AppSidebar.vue'
import AppTopbar from '@components/topbar/AppTopbar.vue'
import Toast from '@components/ui/Toast.vue'

const isMobileDrawerOpen = ref(false)

function openDrawer() { isMobileDrawerOpen.value = true }
function closeDrawer() { isMobileDrawerOpen.value = false }
</script>

<template>
  <div class="flex h-screen bg-surface overflow-hidden">
    <!-- Skip to main content (keyboard accessibility) -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
    >
      Skip to main content
    </a>

    <!-- Sidebar — desktop: fixed; mobile: hidden -->
    <AppSidebar
      :is-mobile-open="isMobileDrawerOpen"
      @close="closeDrawer"
    />

    <!-- Mobile drawer backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileDrawerOpen"
        class="fixed inset-0 z-20 bg-black/50 lg:hidden"
        aria-hidden="true"
        @click="closeDrawer"
      />
    </Transition>

    <!-- Right panel: topbar + scrollable content -->
    <div class="flex flex-col flex-1 min-w-0">
      <AppTopbar @open-drawer="openDrawer" />

      <main
        id="main-content"
        class="flex-1 overflow-y-auto bg-surface-secondary"
        tabindex="-1"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <RouterView />
        </div>
      </main>
    </div>

    <!-- Toast notifications -->
    <Toast />
  </div>
</template>
