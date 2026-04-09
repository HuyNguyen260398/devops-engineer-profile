<script setup>
defineProps({
  size: { type: Number, default: 20 },
})
</script>

<template>
  <span role="status" aria-label="Loading" class="inline-flex">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      class="animate-spin text-current"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="31.416"
        stroke-dashoffset="10"
        opacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>
