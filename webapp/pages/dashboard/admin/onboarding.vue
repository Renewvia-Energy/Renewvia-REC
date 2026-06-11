<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <h1 class="font-display text-2xl font-semibold text-text-primary">Onboarding Queue</h1>
    <AdminOnboardingReview :submissions="submissions" @refresh="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Onboarding Queue' })

const { data, refresh } = await useFetch('/api/onboarding?all=true', {
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
