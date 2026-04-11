<script setup>
import { watch } from 'vue'
import { Link, Download, ArrowRight, AlertCircle, FileText } from 'lucide-vue-next'
import BaseButton from '@components/ui/BaseButton.vue'
import LoadingSpinner from '@components/ui/LoadingSpinner.vue'
import MarkdownPreview from '@components/html-to-markdown/MarkdownPreview.vue'
import ConversionLoader from '@components/html-to-markdown/ConversionLoader.vue'
import { useHtmlToMarkdown } from '@/composables/useHtmlToMarkdown.js'

const { url, markdown, isLoading, error, convert, downloadMarkdown } = useHtmlToMarkdown()

watch(url, () => {
  if (error.value) error.value = null
})

function handleSubmit() {
  if (!isLoading.value) convert()
}
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- Page header -->
    <div class="shrink-0 px-6 pt-6 pb-4 border-b border-border">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center shrink-0">
          <FileText class="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-semibold text-on-surface leading-tight">HTML to Markdown</h1>
          <p class="mt-0.5 text-sm text-on-surface-muted">
            Enter a public URL and convert the page content to clean Markdown.
          </p>
        </div>
      </div>
    </div>

    <!-- URL input row -->
    <div class="shrink-0 px-6 py-4 border-b border-border bg-surface-secondary">
      <form class="flex gap-3 items-end" @submit.prevent="handleSubmit">

        <div class="flex-1 flex flex-col gap-1">
          <label for="url-input" class="text-xs font-medium text-on-surface-muted tracking-wide uppercase">
            Website URL
          </label>
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Link class="w-4 h-4 text-on-surface-subtle" />
            </span>
            <input
              id="url-input"
              v-model="url"
              type="url"
              placeholder="https://example.com/page"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="!!error"
              aria-describedby="url-error"
              class="w-full pl-9 pr-4 py-2.5 text-sm rounded-md bg-surface text-on-surface border placeholder:text-on-surface-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              :class="error ? 'border-accent-red' : 'border-border'"
            />
          </div>
          <p
            v-if="error"
            id="url-error"
            role="alert"
            class="flex items-center gap-1.5 text-xs text-accent-red mt-0.5"
          >
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />
            {{ error }}
          </p>
        </div>

        <!-- Convert -->
        <BaseButton
          type="submit"
          :disabled="!url.trim() || isLoading"
          size="md"
          class="shrink-0"
        >
          <LoadingSpinner v-if="isLoading" :size="16" />
          <template v-else>
            Convert
            <ArrowRight class="w-4 h-4" />
          </template>
        </BaseButton>

        <!-- Download — appears after conversion -->
        <BaseButton
          v-if="markdown && !isLoading"
          variant="secondary"
          size="md"
          class="shrink-0"
          @click="downloadMarkdown"
        >
          <Download class="w-4 h-4" />
          Download .md
        </BaseButton>

      </form>
    </div>

    <!-- Content area -->
    <div class="flex-1 min-h-0">

      <!-- Initial / empty state -->
      <div
        v-if="!markdown && !isLoading && !error"
        class="flex flex-col items-center justify-center h-full gap-4 text-center px-6"
      >
        <div class="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center">
          <FileText class="w-7 h-7 text-on-surface-subtle" />
        </div>
        <div>
          <p class="text-sm font-medium text-on-surface">Enter a URL to get started</p>
          <p class="mt-1 text-sm text-on-surface-muted max-w-xs">
            Paste any public webpage URL above and click Convert. The Markdown will appear here.
          </p>
        </div>
        <p class="text-xs text-on-surface-subtle">
          Powered by <span class="font-mono">r.jina.ai</span>
        </p>
      </div>

      <!-- Loading state -->
      <ConversionLoader v-else-if="isLoading" />

      <!-- Error state (no markdown) -->
      <div
        v-else-if="error && !markdown"
        class="flex flex-col items-center justify-center h-full gap-4 text-center px-6"
      >
        <div class="w-14 h-14 rounded-2xl bg-accent-red-subtle border border-accent-red-muted flex items-center justify-center">
          <AlertCircle class="w-7 h-7 text-accent-red" />
        </div>
        <div>
          <p class="text-sm font-medium text-on-surface">Conversion failed</p>
          <p class="mt-1 text-sm text-on-surface-muted max-w-xs">{{ error }}</p>
        </div>
      </div>

      <!-- Preview -->
      <div v-else-if="markdown" class="h-full bg-surface">
        <MarkdownPreview :markdown="markdown" />
      </div>

    </div>
  </div>
</template>
