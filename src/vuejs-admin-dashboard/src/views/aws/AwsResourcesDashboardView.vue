<script setup>
import PageHeader from '@components/ui/PageHeader.vue'
import EmptyState from '@components/ui/EmptyState.vue'
</script>

<template>
  <div>
    <PageHeader
      title="AWS Resources Dashboard"
      subtitle="Browse and audit your AWS resources."
    />
    <EmptyState
      title="Coming Soon"
      description="This dashboard is under development and will be available soon."
    />
  </div>
</template>
