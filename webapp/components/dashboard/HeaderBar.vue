<template>
  <div class="flex items-center gap-5 border-b border-border pb-5">
    <!-- Company logo -->
    <img
      v-if="company?.logo"
      :src="company.logo"
      :alt="company.name"
      class="h-12 w-12 rounded object-contain bg-surface-overlay border border-border p-1 shrink-0"
      loading="eager"
      decoding="async"
      @error="logoError = true"
    />
    <div
      v-else
      class="h-12 w-12 rounded bg-surface-overlay border border-border flex items-center justify-center shrink-0"
    >
      <span class="text-xs font-bold text-text-muted">{{ initials }}</span>
    </div>

    <!-- Company info -->
    <div class="flex-1 min-w-0">
      <h1 class="font-display text-2xl font-bold text-text-primary truncate">
        {{ company?.name ?? 'My Account' }}
      </h1>
      <div class="flex items-center gap-4 mt-0.5 flex-wrap">
        <span v-if="company?.join_date" class="text-sm text-text-secondary">
          Member since {{ formatJoinDate(company.join_date) }}
        </span>
        <a
          v-if="wallet"
          :href="`${config.public.polygonscanBase}/address/${wallet}`"
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono text-xs text-brand hover:underline tabular-nums"
          :title="wallet"
        >
          {{ wallet.slice(0, 6) }}…{{ wallet.slice(-4) }} ↗
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyRecord } from '~/stores/contracts'

const props = defineProps<{
  company?: CompanyRecord
  wallet: string
}>()

const config = useRuntimeConfig()
const logoError = ref(false)

const initials = computed(() => {
  if (!props.company?.name) return '?'
  return props.company.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
})

function formatJoinDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}
</script>
