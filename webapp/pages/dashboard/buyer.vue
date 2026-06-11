<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <h1 class="font-display text-2xl font-semibold text-text-primary">Goals &amp; Orders</h1>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <BuyerGoalsPanel />
      <BuyerOrderPanel @placed="refresh()" />
    </div>

    <!-- My orders table -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-display text-lg font-semibold text-text-primary">Order history</h2>
      </div>
      <div class="card-body p-0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Side</th>
              <th>Type</th>
              <th class="text-right">Amount (MWh)</th>
              <th class="text-right">Limit</th>
              <th class="text-right">Stop</th>
              <th>Status</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="orders.length === 0">
              <td colspan="8" class="text-center text-text-muted py-8">No orders placed yet</td>
            </tr>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.contractName ?? 'Any' }}</td>
              <td>
                <span :class="order.side === 'buy' ? 'text-success font-semibold' : order.side === 'sell' ? 'text-danger font-semibold' : 'text-brand font-semibold'">
                  {{ order.side.toUpperCase() }}
                </span>
              </td>
              <td class="capitalize">{{ order.orderType === 'n/a' ? '—' : order.orderType }}</td>
              <td class="numeric">{{ order.amount.toLocaleString() }}</td>
              <td class="numeric text-text-secondary">{{ order.limitPrice ? `$${Number(order.limitPrice).toFixed(2)}` : '—' }}</td>
              <td class="numeric text-text-secondary">{{ order.stopPrice  ? `$${Number(order.stopPrice).toFixed(2)}`  : '—' }}</td>
              <td><span :class="`badge badge-${order.status}`">{{ order.status }}</span></td>
              <td>{{ formatDate(order.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'buyer' })
useHead({ title: 'Goals & Orders' })

const { data, refresh } = await useFetch('/api/orders')
const orders = computed(() => data.value?.orders ?? [])

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

onActivated(() => refresh())
</script>
