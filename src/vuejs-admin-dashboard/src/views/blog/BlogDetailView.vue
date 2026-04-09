<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-vue-next'
import { useBlogStore } from '@/stores/blog.js'
import { useToast } from '@/composables/useToast.js'
import { parseMarkdown } from '@/utils/markdown.js'
import StatusBadge from '@components/ui/StatusBadge.vue'
import BaseButton from '@components/ui/BaseButton.vue'
import ConfirmDialog from '@components/ui/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useBlogStore()
const { success, error } = useToast()

const post = computed(() => store.getPostById(route.params.id))
const renderedContent = computed(() => (post.value ? parseMarkdown(post.value.content) : ''))

const showConfirm = ref(false)
const deleting = ref(false)

onMounted(() => {
  if (!post.value) router.replace({ name: 'blog-list' })
})

async function handleDelete() {
  deleting.value = true
  try {
    store.deletePost(post.value.id)
    showConfirm.value = false
    success('Post deleted.')
    router.push({ name: 'blog-list' })
  } catch (e) {
    error(e.message)
  } finally {
    deleting.value = false
  }
}

const formattedDate = computed(() => {
  if (!post.value) return ''
  return new Date(post.value.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
})
</script>

<template>
  <div v-if="post">
    <!-- Header actions -->
    <div class="flex items-center justify-between gap-4 mb-6">
      <BaseButton variant="ghost" size="sm" @click="router.back()">
        <template #icon>
          <ArrowLeft :size="15" aria-hidden="true" />
        </template>
        Back
      </BaseButton>
      <div class="flex items-center gap-2">
        <BaseButton
          variant="secondary"
          size="sm"
          @click="router.push({ name: 'blog-edit', params: { id: post.id } })"
        >
          <template #icon>
            <Pencil :size="14" aria-hidden="true" />
          </template>
          Edit
        </BaseButton>
        <BaseButton
          variant="danger"
          size="sm"
          @click="showConfirm = true"
        >
          <template #icon>
            <Trash2 :size="14" aria-hidden="true" />
          </template>
          Delete
        </BaseButton>
      </div>
    </div>

    <!-- Post meta -->
    <div class="mb-6">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <StatusBadge :status="post.status" />
        <span class="text-xs text-on-surface-subtle font-mono">Updated {{ formattedDate }}</span>
      </div>
      <h1 class="text-2xl font-semibold text-on-surface mb-2">{{ post.title }}</h1>
      <p v-if="post.excerpt" class="text-on-surface-muted">{{ post.excerpt }}</p>

      <!-- Tags -->
      <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5 mt-3">
        <span
          v-for="tag in post.tags"
          :key="tag"
          class="px-2 py-0.5 bg-surface-secondary border border-border rounded-md text-xs text-on-surface-muted font-mono"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="bg-surface border border-border rounded-xl p-6">
      <div
        v-if="post.content"
        class="prose-github"
        v-html="renderedContent"
      />
      <p v-else class="text-on-surface-subtle text-sm italic">No content yet.</p>
    </div>

    <!-- Confirm delete dialog -->
    <ConfirmDialog
      v-model="showConfirm"
      title="Delete post?"
      :message="`&quot;${post.title}&quot; will be permanently deleted and cannot be recovered.`"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>
