<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Globe, FileText, Sparkles } from 'lucide-vue-next'

const stages = [
  { icon: Globe,     label: 'Connecting to Jina Reader' },
  { icon: FileText,  label: 'Fetching page content'     },
  { icon: Sparkles,  label: 'Converting to Markdown'    },
]

const activeStage = ref(0)
let interval = null

onMounted(() => {
  interval = setInterval(() => {
    activeStage.value = (activeStage.value + 1) % stages.length
  }, 1800)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full gap-8 px-6">

    <!-- Indeterminate shimmer bar -->
    <div class="w-64 h-1 rounded-full bg-surface-secondary overflow-hidden">
      <div class="h-full w-1/3 rounded-full bg-primary shimmer-slide" />
    </div>

    <!-- Stage indicators -->
    <div class="flex flex-col gap-3">
      <div
        v-for="(stage, i) in stages"
        :key="i"
        class="flex items-center gap-3 transition-all duration-500"
        :class="i === activeStage
          ? 'opacity-100 translate-x-0'
          : i < activeStage
            ? 'opacity-30 translate-x-0'
            : 'opacity-20 translate-x-0'"
      >
        <!-- Icon bubble -->
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500"
          :class="i === activeStage
            ? 'bg-primary text-white'
            : i < activeStage
              ? 'bg-accent-green-muted text-accent-green'
              : 'bg-surface-secondary text-on-surface-subtle'"
        >
          <component :is="stage.icon" class="w-4 h-4" />
        </div>

        <!-- Label + pulse dot for active -->
        <div class="flex items-center gap-2">
          <span
            class="text-sm font-medium transition-colors duration-500"
            :class="i === activeStage ? 'text-on-surface' : 'text-on-surface-muted'"
          >
            {{ stage.label }}
          </span>
          <span
            v-if="i === activeStage"
            class="flex gap-0.5"
            aria-hidden="true"
          >
            <span class="w-1 h-1 rounded-full bg-primary inline-block dot-bounce" style="animation-delay: 0ms" />
            <span class="w-1 h-1 rounded-full bg-primary inline-block dot-bounce" style="animation-delay: 150ms" />
            <span class="w-1 h-1 rounded-full bg-primary inline-block dot-bounce" style="animation-delay: 300ms" />
          </span>
        </div>
      </div>
    </div>

    <p class="text-xs text-on-surface-subtle">This may take a few seconds for larger pages</p>
  </div>
</template>

<style scoped>
.shimmer-slide {
  animation: shimmer-slide 1.6s ease-in-out infinite;
}

@keyframes shimmer-slide {
  0%   { transform: translateX(-300%); }
  100% { transform: translateX(400%); }
}

.dot-bounce {
  animation: dot-bounce 0.9s ease-in-out infinite;
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%           { transform: translateY(-4px); opacity: 1;   }
}
</style>
