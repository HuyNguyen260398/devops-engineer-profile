<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  markdown: { type: String, required: true },
})

const activeTab = ref('rendered')

const renderedHtml = computed(() => marked(props.markdown))

const tabs = [
  { id: 'rendered', label: 'Preview' },
  { id: 'raw', label: 'Markdown' },
]
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Tab bar -->
    <div class="flex items-center gap-0.5 border-b border-border px-1 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="relative px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t"
        :class="activeTab === tab.id
          ? 'text-on-surface'
          : 'text-on-surface-muted hover:text-on-surface'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <!-- Active indicator -->
        <span
          v-if="activeTab === tab.id"
          class="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full"
        />
      </button>
    </div>

    <!-- Rendered preview -->
    <div
      v-if="activeTab === 'rendered'"
      class="flex-1 overflow-y-auto p-6"
    >
      <div
        class="prose-github max-w-none"
        v-html="renderedHtml"
      />
    </div>

    <!-- Raw markdown -->
    <div
      v-else
      class="flex-1 overflow-auto"
    >
      <pre class="h-full m-0 p-6 text-sm font-mono text-on-surface leading-relaxed whitespace-pre-wrap break-words">{{ markdown }}</pre>
    </div>
  </div>
</template>
