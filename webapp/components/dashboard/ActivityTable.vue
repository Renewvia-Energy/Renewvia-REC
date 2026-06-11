<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Activity</h2>
      <span class="text-sm text-text-muted">{{ activity.length }} transactions</span>
    </div>
    <div class="card-body p-0 overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Asset</th>
            <th class="text-right">Amount (MWh)</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="activity.length === 0">
            <td colspan="5" class="text-center text-text-muted py-10">No activity</td>
          </tr>
          <tr v-for="(item, i) in displayedActivity" :key="i">
            <td class="text-text-secondary whitespace-nowrap">{{ item.date }}</td>
            <td>
              <span :class="actionClass(item.action)" class="font-semibold">{{ item.action }}</span>
            </td>
            <td>
              <p class="font-medium">{{ item.abbreviation }}</p>
              <p class="text-2xs text-text-muted">{{ item.name }}</p>
            </td>
            <td class="numeric" :class="item.signedAmount > 0 ? 'text-success' : 'text-danger'">
              {{ item.signedAmount > 0 ? '+' : '' }}{{ item.amount.toLocaleString() }}
            </td>
            <td>
              <a
                v-if="item.hash"
                :href="`${config.public.polygonscanBase}/tx/${item.hash}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-2xs text-brand hover:underline"
                :title="item.hash"
              >
                {{ item.hash.slice(0, 8) }}… ↗
              </a>
              <span v-else class="text-2xs text-text-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="activity.length > pageSize" class="px-5 py-3 border-t border-border flex items-center justify-between text-sm">
      <span class="text-text-muted">Showing {{ displayedActivity.length }} of {{ activity.length }}</span>
      <button
        v-if="page * pageSize < activity.length"
        class="text-brand hover:underline"
        @click="page++"
      >
        Load more
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActivityItem } from '~/stores/contracts'

const props = defineProps<{ activity: ActivityItem[] }>()

const config = useRuntimeConfig()
const page     = ref(1)
const pageSize = 25

const displayedActivity = computed(() =>
  // Show newest first
  [...props.activity]
    .reverse()
    .slice(0, page.value * pageSize),
)

function actionClass(action: string): string {
  switch (action) {
    case 'Generation': return 'text-success'
    case 'Sale':       return 'text-accent'
    case 'Purchase':   return 'text-brand'
    case 'Return':     return 'text-text-secondary'
    case 'Retirement': return 'text-danger'
    case 'Receipt':    return 'text-info'
    default:           return 'text-text-primary'
  }
}
</script>
