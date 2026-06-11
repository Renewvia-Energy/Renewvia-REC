<template>
  <div class="space-y-6">

    <!-- RECs table -->
    <div v-if="recRetirements.length > 0" class="card">
      <div class="card-header">
        <h2 class="font-display text-lg font-semibold text-text-primary">Retired RECs</h2>
      </div>
      <div class="card-body p-0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th class="text-right">Amount (MWh)</th>
              <th>Transaction</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in recRetirements" :key="item.blockNumber + item.contractAddress">
              <td>{{ item.date }}</td>
              <td>
                <p class="font-medium text-text-primary">{{ item.abbreviation }}</p>
                <p class="text-2xs text-text-muted truncate max-w-[160px]">{{ item.name }}</p>
              </td>
              <td class="numeric">{{ item.amount.toLocaleString() }}</td>
              <td>
                <a
                  v-if="item.hash"
                  :href="`${polygonscanBase}/tx/${item.hash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-2xs text-brand hover:underline"
                  :title="item.hash"
                >
                  {{ item.hash.slice(0, 10) }}…
                </a>
                <span v-else class="text-2xs text-text-muted">—</span>
              </td>
              <td class="text-right">
                <button
                  class="rounded border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-brand transition-colors"
                  @click="$emit('certify', item)"
                >
                  Certificate
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Carbon credits table -->
    <div v-if="ccRetirements.length > 0" class="card">
      <div class="card-header">
        <h2 class="font-display text-lg font-semibold text-text-primary">Retired Carbon Credits</h2>
      </div>
      <div class="card-body p-0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th class="text-right">Amount (tCO₂e)</th>
              <th>Transaction</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in ccRetirements" :key="item.blockNumber + item.contractAddress">
              <td>{{ item.date }}</td>
              <td>
                <p class="font-medium text-text-primary">{{ item.abbreviation }}</p>
                <p class="text-2xs text-text-muted truncate max-w-[160px]">{{ item.name }}</p>
              </td>
              <td class="numeric">{{ item.amount.toLocaleString() }}</td>
              <td>
                <a
                  v-if="item.hash"
                  :href="`${polygonscanBase}/tx/${item.hash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-2xs text-brand hover:underline"
                  :title="item.hash"
                >
                  {{ item.hash.slice(0, 10) }}…
                </a>
                <span v-else class="text-2xs text-text-muted">—</span>
              </td>
              <td class="text-right">
                <button
                  class="rounded border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-brand transition-colors"
                  @click="$emit('certify', item)"
                >
                  Certificate
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="retirements.length === 0" class="card">
      <div class="card-body text-center text-text-muted py-8">
        No retirements on record
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { ActivityItem } from '~/stores/contracts'
import { useContractsStore } from '~/stores/contracts'

const props = defineProps<{
  retirements: ActivityItem[]
  polygonscanBase: string
}>()

defineEmits<{ certify: [item: ActivityItem] }>()

const contractsStore = useContractsStore()

function superclassFor(item: ActivityItem): string {
  return contractsStore.contractsRaw.find(
    c => c.address && c.address.toLowerCase() === item.contractAddress?.toLowerCase(),
  )?.superclass ?? 'REC'
}

const recRetirements = computed(() =>
  props.retirements.filter(item => superclassFor(item) === 'REC'),
)

const ccRetirements = computed(() =>
  props.retirements.filter(item => superclassFor(item) === 'CC'),
)
</script>
