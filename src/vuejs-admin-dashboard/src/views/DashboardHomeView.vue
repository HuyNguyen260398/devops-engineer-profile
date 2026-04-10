<script setup>
import { ref, computed } from 'vue'
import { BookOpen, FileCode, DollarSign, Server, Search } from 'lucide-vue-next'
import PageHeader from '@components/ui/PageHeader.vue'
import EmptyState from '@components/ui/EmptyState.vue'
import AppCard from '@components/dashboard/AppCard.vue'

const apps = [
  {
    name: 'Blog',
    description: 'Create and manage blog posts',
    icon: BookOpen,
    iconClass: 'text-primary',
    iconBgClass: 'bg-primary-muted',
    to: { name: 'blog-list' },
    badge: '',
  },
  {
    name: 'HTML to Markdown',
    description: 'Convert HTML pages to clean Markdown',
    icon: FileCode,
    iconClass: 'text-accent-green',
    iconBgClass: 'bg-accent-green-subtle',
    to: { name: 'html-to-markdown' },
    badge: 'Coming Soon',
  },
  {
    name: 'AWS Cost Dashboard',
    description: 'Monitor and analyse your AWS spend',
    icon: DollarSign,
    iconClass: 'text-accent-yellow',
    iconBgClass: 'bg-accent-yellow-subtle',
    to: { name: 'aws-cost' },
    badge: 'Coming Soon',
  },
  {
    name: 'AWS Resources Dashboard',
    description: 'Browse and audit your AWS resources',
    icon: Server,
    iconClass: 'text-on-surface-muted',
    iconBgClass: 'bg-surface-secondary',
    to: { name: 'aws-resources' },
    badge: 'Coming Soon',
  },
]

const query = ref('')

const filteredApps = computed(() =>
  apps.filter(
    (a) =>
      a.name.toLowerCase().includes(query.value.toLowerCase()) ||
      a.description.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
</script>

<template>
  <div>
    <PageHeader
      title="Apps"
      subtitle="Browse and launch your tools."
    />

    <!-- Search bar -->
    <div class="relative mb-6">
      <Search
        :size="16"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        v-model="query"
        type="search"
        placeholder="Search apps…"
        aria-label="Search apps"
        class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-surface text-on-surface border border-border placeholder:text-on-surface-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
    </div>

    <!-- App grid -->
    <div v-if="filteredApps.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AppCard
        v-for="app in filteredApps"
        :key="app.name"
        v-bind="app"
      />
    </div>

    <!-- No results -->
    <EmptyState
      v-else
      title="No apps found"
      description="Try a different search term."
    />
  </div>
</template>
