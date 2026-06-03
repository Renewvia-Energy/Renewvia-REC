<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <h1 class="font-display text-2xl font-semibold text-text-primary">Futures Queue</h1>
    <AdminFuturesReview :submissions="submissions" @refresh="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Futures Queue' })

const { data, refresh } = await useFetch('/api/futures?all=true', {
  transform: (res) => ({
    submissions: res.submissions.map(s => ({
      ...s,
      createdAt:  new Date(s.createdAt),
      updatedAt:  new Date(s.updatedAt),
      reviewedAt: s.reviewedAt ? new Date(s.reviewedAt) : null,
    })),
  }),
})
const submissions = computed(() => data.value?.submissions ?? [])
</script>
