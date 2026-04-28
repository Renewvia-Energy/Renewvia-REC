<template>
  <div class="space-y-4">
    <div class="flex gap-2">
      <button
        v-for="f in filters"
        :key="f.value"
        class="px-3 py-1 rounded text-sm border transition-colors"
        :class="activeFilter === f.value
          ? 'bg-brand border-brand text-white'
          : 'border-border text-text-secondary hover:text-text-primary'"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
        <span class="ml-1 font-mono text-2xs">{{ countByStatus(f.value) }}</span>
      </button>
    </div>

    <div class="card">
      <div class="card-body p-0 overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Company</th>
              <th>Asset</th>
              <th>Side</th>
              <th>Type</th>
              <th class="text-right">Amount</th>
              <th class="text-right">Limit $</th>
              <th class="text-right">Stop $</th>
              <th>Status</th>
              <th>Placed</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filtered.length === 0">
              <td colspan="12" class="text-center text-text-muted py-10">No orders</td>
            </tr>
            <template v-for="order in filtered" :key="order.id">
              <tr>
                <td class="font-mono">#{{ order.id }}</td>
                <td class="font-mono text-2xs text-text-muted">
                  {{ order.companyWallet.slice(0, 8) }}…
                </td>
                <td>
                  <p class="font-medium">{{ order.abbreviation ?? '—' }}</p>
                  <p class="text-2xs text-text-muted">{{ order.contractName ?? 'Any' }}</p>
                </td>
                <td>
                  <span :class="order.side === 'buy' ? 'text-success font-semibold' : 'text-danger font-semibold'">
                    {{ order.side.toUpperCase() }}
                  </span>
                </td>
                <td class="capitalize">{{ order.orderType }}</td>
                <td class="numeric">{{ order.amount.toLocaleString() }}</td>
                <td class="numeric text-text-secondary">{{ order.limitPrice ?? '—' }}</td>
                <td class="numeric text-text-secondary">{{ order.stopPrice ?? '—' }}</td>
                <td><span :class="`badge badge-${order.status}`">{{ order.status }}</span></td>
                <td class="whitespace-nowrap text-text-secondary">{{ formatDate(order.createdAt) }}</td>
                <td class="text-text-secondary text-xs max-w-xs truncate">{{ order.notes ?? '—' }}</td>
                <td class="text-right pr-4">
                  <template v-if="order.status === 'pending'">
                    <button
                      class="text-xs text-success hover:underline mr-2"
                      @click="openAction(order.uuid, 'executed')"
                    >
                      Execute
                    </button>
                    <button
                      class="text-xs text-danger hover:underline"
                      @click="openAction(order.uuid, 'cancelled')"
                    >
                      Cancel
                    </button>
                  </template>
                </td>
              </tr>

              <!-- Inline processingNotes form when action is triggered -->
              <tr v-if="pendingAction?.orderId === order.uuid">
                <td colspan="12" class="bg-surface-raised px-4 py-3">
                  <div class="flex items-start gap-3">
                    <div class="flex-1">
                      <label class="block text-xs font-medium text-text-secondary mb-1">
                        Processing notes
                        <span class="font-normal text-text-muted">(optional)</span>
                      </label>
                      <input
                        v-model="processingNotes"
                        type="text"
                        class="rex-input w-full"
                        :placeholder="pendingAction.status === 'executed' ? 'e.g. Executed at market price…' : 'e.g. Insufficient holdings…'"
                        @keydown.enter="confirmAction"
                        @keydown.escape="cancelAction"
                      />
                    </div>
                    <div class="flex gap-2 mt-5">
                      <button
                        class="rounded px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        :class="pendingAction.status === 'executed' ? 'bg-success' : 'bg-danger'"
                        @click="confirmAction"
                      >
                        Confirm {{ pendingAction.status === 'executed' ? 'execute' : 'cancel' }}
                      </button>
                      <button
                        class="rounded border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                        @click="cancelAction"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface AdminOrder {
  id:              number
  userId:          number
  companyWallet:   string
  contractAddress: string | null
  contractName:    string | null
  abbreviation:    string | null
  side:            string
  orderType:       string
  amount:          number
  limitPrice:      string | null
  stopPrice:       string | null
  notes:           string | null
  status:          string
  createdAt:       string | Date
  processedAt:     string | Date | null
  processingNotes: string | null
}

const props = defineProps<{ orders: AdminOrder[] }>()
const emit  = defineEmits<{ refresh: [] }>()

const activeFilter  = ref('pending')
const processingNotes = ref('')
const pendingAction = ref<{ orderId: string; status: 'executed' | 'cancelled' } | null>(null)

const filters = [
  { label: 'Pending',   value: 'pending' },
  { label: 'Executed',  value: 'executed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'All',       value: '' },
]

const filtered = computed<AdminOrder[]>(() =>
  activeFilter.value
    ? props.orders.filter(o => o.status === activeFilter.value)
    : props.orders,
)

function countByStatus(status: string): number {
  return status ? props.orders.filter(o => o.status === status).length : props.orders.length
}

function openAction(orderId: string, status: 'executed' | 'cancelled') {
  processingNotes.value = ''
  pendingAction.value   = { orderId, status }
}

function cancelAction() {
  pendingAction.value = null
}

async function confirmAction() {
  if (!pendingAction.value) return
  const { orderId, status } = pendingAction.value
  await $fetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    body: { status, processingNotes: processingNotes.value || undefined },
  })
  pendingAction.value = null
  emit('refresh')
}

const { formatDate } = useFormatters()
</script>
