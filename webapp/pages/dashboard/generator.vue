<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl font-semibold text-text-primary">Generation</h1>
      <NuxtLink
        to="/onboarding"
        class="rounded border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
      >
        + New project
      </NuxtLink>
    </div>

    <GeneratorGenerationChart />
    <GeneratorSitesMap />

    <!-- Onboarding submissions summary -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-display text-lg font-semibold text-text-primary">Onboarding submissions</h2>
      </div>
      <div class="card-body p-0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Reviewed</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="submissions.length === 0">
              <td colspan="5" class="text-center text-text-muted py-8">No submissions yet</td>
            </tr>
            <tr v-for="sub in submissions" :key="sub.id">
              <td class="font-mono">
                <NuxtLink
                  v-if="sub.status === 'draft'"
                  :to="`/onboarding?id=${sub.id}`"
                  class="text-brand hover:underline"
                >{{ sub.projectName || '(unnamed)' }}</NuxtLink>
                <span v-else>{{ sub.projectName || '(unnamed)' }}</span>
              </td>
              <td><span :class="`badge badge-${sub.status}`">{{ sub.status }}</span></td>
              <td>{{ formatDate(sub.createdAt) }}</td>
              <td>{{ sub.reviewedAt ? formatDate(sub.reviewedAt) : '—' }}</td>
              <td class="text-text-secondary max-w-xs truncate">{{ sub.reviewNotes ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'generator' })
useHead({ title: 'Generation' })

const { data, refresh } = await useFetch('/api/onboarding')
const submissions = computed(() => data.value?.submissions ?? [])

onMounted(() => refresh())

const { formatDate } = useFormatters()
</script>
