<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, PenSquare } from 'lucide-vue-next'
import { useBlogStore } from '@/stores/blog.js'
import PageHeader from '@components/ui/PageHeader.vue'
import BaseButton from '@components/ui/BaseButton.vue'
import EmptyState from '@components/ui/EmptyState.vue'
import PostCard from '@components/blog/PostCard.vue'

const store = useBlogStore()
const router = useRouter()

const posts = computed(() => store.posts)
</script>

<template>
  <div>
    <PageHeader
      title="Blog Posts"
      :subtitle="`${posts.length} post${posts.length !== 1 ? 's' : ''} total`"
    >
      <template #actions>
        <BaseButton
          variant="primary"
          size="md"
          @click="router.push({ name: 'blog-new' })"
        >
          <template #icon>
            <PenSquare :size="15" aria-hidden="true" />
          </template>
          New Post
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Post grid -->
    <div
      v-if="posts.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
      />
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      title="No posts yet"
      description="Create your first blog post to get started."
    >
      <template #icon>
        <BookOpen :size="40" />
      </template>
      <template #action>
        <BaseButton variant="primary" @click="router.push({ name: 'blog-new' })">
          Create your first post
        </BaseButton>
      </template>
    </EmptyState>
  </div>
</template>
