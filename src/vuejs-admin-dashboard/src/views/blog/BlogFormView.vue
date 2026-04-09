<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Eye, EyeOff } from 'lucide-vue-next'
import { useBlogStore } from '@/stores/blog.js'
import { useToast } from '@/composables/useToast.js'
import { parseMarkdown } from '@/utils/markdown.js'
import PageHeader from '@components/ui/PageHeader.vue'
import BaseButton from '@components/ui/BaseButton.vue'
import BaseInput from '@components/ui/BaseInput.vue'
import BaseTextarea from '@components/ui/BaseTextarea.vue'
import BaseSelect from '@components/ui/BaseSelect.vue'

const route = useRoute()
const router = useRouter()
const store = useBlogStore()
const { success, error } = useToast()

const isEdit = computed(() => !!route.params.id)
const pageTitle = computed(() => (isEdit.value ? 'Edit Post' : 'New Post'))

const form = reactive({
  title: '',
  excerpt: '',
  content: '',
  tagsRaw: '',
  status: 'draft',
})

const errors = reactive({
  title: '',
  content: '',
})

const touched = reactive({
  title: false,
  content: false,
})

const saving = ref(false)
const showPreview = ref(false)

const renderedPreview = computed(() => parseMarkdown(form.content))

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
]

const isValid = computed(() => !errors.title && !errors.content && form.title.trim())

onMounted(() => {
  if (isEdit.value) {
    const post = store.getPostById(route.params.id)
    if (!post) {
      router.replace({ name: 'blog-list' })
      return
    }
    form.title = post.title
    form.excerpt = post.excerpt
    form.content = post.content
    form.tagsRaw = post.tags.join(', ')
    form.status = post.status
  }
})

function validateTitle() {
  if (!form.title.trim()) {
    errors.title = 'Title is required.'
  } else if (form.title.length > 200) {
    errors.title = 'Title must be 200 characters or fewer.'
  } else {
    errors.title = ''
  }
}

function validateContent() {
  if (!form.content.trim()) {
    errors.content = 'Content is required.'
  } else {
    errors.content = ''
  }
}

function onBlur(field) {
  touched[field] = true
  if (field === 'title') validateTitle()
  if (field === 'content') validateContent()
}

function parseTags(raw) {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

async function submit() {
  touched.title = true
  touched.content = true
  validateTitle()
  validateContent()
  if (!isValid.value) return

  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      tags: parseTags(form.tagsRaw),
      status: form.status,
    }

    if (isEdit.value) {
      store.updatePost(route.params.id, payload)
      success('Post updated.')
      router.push({ name: 'blog-detail', params: { id: route.params.id } })
    } else {
      const post = store.createPost(payload)
      success('Post created.')
      router.push({ name: 'blog-detail', params: { id: post.id } })
    }
  } catch (e) {
    error(e.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="pageTitle">
      <template #actions>
        <BaseButton variant="ghost" size="sm" @click="router.back()">
          <template #icon>
            <ArrowLeft :size="15" aria-hidden="true" />
          </template>
          Back
        </BaseButton>
      </template>
    </PageHeader>

    <form novalidate class="max-w-3xl space-y-5" @submit.prevent="submit">
      <!-- Title -->
      <BaseInput
        v-model="form.title"
        label="Title"
        placeholder="Post title"
        required
        :error="touched.title ? errors.title : ''"
        @blur="onBlur('title')"
      />

      <!-- Excerpt -->
      <BaseTextarea
        v-model="form.excerpt"
        label="Excerpt"
        placeholder="Short description shown in post cards (optional)"
        :rows="2"
      />

      <!-- Content with preview toggle -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-on-surface">
            Content <span class="text-accent-red" aria-hidden="true">*</span>
          </span>
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs text-on-surface-muted hover:text-on-surface font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
            :aria-label="showPreview ? 'Switch to editor' : 'Toggle markdown preview'"
            @click="showPreview = !showPreview"
          >
            <Eye v-if="!showPreview" :size="13" aria-hidden="true" />
            <EyeOff v-else :size="13" aria-hidden="true" />
            {{ showPreview ? 'Edit' : 'Preview' }}
          </button>
        </div>

        <BaseTextarea
          v-if="!showPreview"
          v-model="form.content"
          placeholder="Write your post in Markdown…"
          :rows="12"
          required
          :error="touched.content ? errors.content : ''"
          @blur="onBlur('content')"
        />

        <div
          v-else
          class="min-h-[200px] px-3 py-2 rounded-md bg-surface border border-border overflow-auto"
        >
          <div
            v-if="form.content"
            class="prose-github"
            v-html="renderedPreview"
          />
          <p v-else class="text-sm text-on-surface-subtle italic">Nothing to preview yet.</p>
        </div>
      </div>

      <!-- Tags -->
      <BaseInput
        v-model="form.tagsRaw"
        label="Tags"
        placeholder="vue, javascript, tutorial (comma-separated)"
        helper-text="Separate tags with commas."
      />

      <!-- Status -->
      <BaseSelect
        v-model="form.status"
        label="Status"
        :options="statusOptions"
      />

      <!-- Submit -->
      <div class="flex items-center gap-3 pt-2">
        <BaseButton
          type="submit"
          variant="primary"
          :loading="saving"
          :disabled="saving"
        >
          {{ isEdit ? 'Save Changes' : 'Publish Post' }}
        </BaseButton>
        <BaseButton variant="ghost" type="button" @click="router.back()">
          Cancel
        </BaseButton>
      </div>
    </form>
  </div>
</template>
