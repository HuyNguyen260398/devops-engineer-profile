<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, CheckCircle2, FileText, PenSquare } from 'lucide-vue-next'
import { useBlogStore } from '@/stores/blog.js'
import PageHeader from '@components/ui/PageHeader.vue'
import StatCard from '@components/dashboard/StatCard.vue'
import BaseButton from '@components/ui/BaseButton.vue'

const store = useBlogStore()
const router = useRouter()

const totalPosts = computed(() => store.posts.length)
const published = computed(() => store.posts.filter((p) => p.status === 'published').length)
const drafts = computed(() => store.posts.filter((p) => p.status === 'draft').length)
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      subtitle="Welcome back — here's an overview of your content."
    />

    <!-- Stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <StatCard
        label="Total Posts"
        :value="totalPosts"
        :icon="BookOpen"
        icon-class="text-primary"
        icon-bg-class="bg-primary-muted"
      />
      <StatCard
        label="Published"
        :value="published"
        :icon="CheckCircle2"
        icon-class="text-accent-green"
        icon-bg-class="bg-accent-green-subtle"
      />
      <StatCard
        label="Drafts"
        :value="drafts"
        :icon="FileText"
        icon-class="text-accent-yellow"
        icon-bg-class="bg-accent-yellow-subtle"
      />
    </div>

    <!-- Quick actions -->
    <div class="mb-2">
      <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-widest mb-3 font-mono">
        Quick Actions
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- New post card -->
        <button
          type="button"
          class="group flex items-start gap-4 bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-card text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
          @click="router.push({ name: 'blog-new' })"
        >
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-muted shrink-0">
            <PenSquare :size="20" class="text-primary" aria-hidden="true" />
          </div>
          <div>
            <p class="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">New Blog Post</p>
            <p class="text-xs text-on-surface-muted mt-0.5">Create and publish a new post</p>
          </div>
        </button>

        <!-- View all posts card -->
        <button
          type="button"
          class="group flex items-start gap-4 bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-card text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
          @click="router.push({ name: 'blog-list' })"
        >
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-secondary shrink-0">
            <BookOpen :size="20" class="text-on-surface-muted" aria-hidden="true" />
          </div>
          <div>
            <p class="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">All Posts</p>
            <p class="text-xs text-on-surface-muted mt-0.5">Browse and manage your posts</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
