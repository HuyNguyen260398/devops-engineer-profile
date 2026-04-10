<script setup>
import PageHeader from '@components/ui/PageHeader.vue'
import EmptyState from '@components/ui/EmptyState.vue'
</script>

<template>
  <div>
    <PageHeader
      title="AWS Cost Dashboard"
      subtitle="Monitor and analyse your AWS spend."
    />
    <EmptyState
      title="Coming Soon"
      description="This dashboard is under development and will be available soon."
    />
  </div>
</template>
