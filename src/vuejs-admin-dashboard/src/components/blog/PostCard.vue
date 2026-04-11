<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Calendar, Tag } from 'lucide-vue-next'
import StatusBadge from '@components/ui/StatusBadge.vue'

const props = defineProps({
  post: { type: Object, required: true },
})

const formattedDate = computed(() =>
  new Date(props.post.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
)
</script>

<template>
  <RouterLink
    :to="{ name: 'blog-detail', params: { id: post.id } }"
    class="group flex flex-col bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-card transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
  >
    <!-- Status + date -->
    <div class="flex items-center justify-between gap-2 mb-3">
      <StatusBadge :status="post.status" />
      <span class="flex items-center gap-1 text-xs text-on-surface-subtle font-mono">
        <Calendar :size="11" aria-hidden="true" />
        {{ formattedDate }}
      </span>
    </div>

    <!-- Title -->
    <h3 class="text-base font-semibold text-on-surface group-hover:text-primary transition-colors mb-2 line-clamp-2">
      {{ post.title }}
    </h3>

    <!-- Excerpt -->
    <p
      v-if="post.excerpt"
      class="text-sm text-on-surface-muted line-clamp-2 mb-4 flex-1"
    >
      {{ post.excerpt }}
    </p>
    <div v-else class="flex-1" />

    <!-- Tags -->
    <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-border">
      <span
        v-for="tag in post.tags.slice(0, 4)"
        :key="tag"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-secondary text-xs text-on-surface-muted font-mono border border-border"
      >
        <Tag :size="10" aria-hidden="true" />
        {{ tag }}
      </span>
      <span
        v-if="post.tags.length > 4"
        class="text-xs text-on-surface-subtle font-mono self-center"
      >
        +{{ post.tags.length - 4 }}
      </span>
    </div>
  </RouterLink>
</template>
