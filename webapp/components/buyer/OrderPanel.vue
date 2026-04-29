<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Place order</h2>
    </div>
    <div class="card-body space-y-4">
      <p class="text-sm text-text-muted">
        Orders are queued for REX staff to execute via paper contract. No prices are shown or required.
      </p>

      <form class="space-y-4" @submit.prevent="submitOrder">
        <!-- Side -->
        <div class="flex gap-2">
          <button
            v-for="s in ['buy', 'sell']"
            :key="s"
            type="button"
            class="flex-1 py-2.5 min-h-[44px] rounded text-sm font-semibold border transition-colors"
            :class="form.side === s
              ? s === 'buy'
                ? 'bg-success border-success text-white'
                : 'bg-danger border-danger text-white'
              : 'border-border text-text-secondary hover:text-text-primary'"
            @click="form.side = s as 'buy' | 'sell'"
          >
            {{ s.toUpperCase() }}
          </button>
        </div>

        <!-- Order type -->
        <div>
          <label for="op-order-type" class="block text-xs font-medium text-text-secondary mb-1">Order type</label>
          <select id="op-order-type" v-model="form.orderType" class="rex-select w-full">
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop-limit">Stop-Limit</option>
          </select>
        </div>

        <!-- Limit price — shown for limit and stop-limit -->
        <div v-if="form.orderType === 'limit' || form.orderType === 'stop-limit'">
          <label for="op-limit-price" class="block text-xs font-medium text-text-secondary mb-1">Limit price (USD/MWh)</label>
          <input
            id="op-limit-price"
            v-model.number="form.limitPrice"
            type="number"
            min="0"
            step="0.01"
            required
            class="rex-input w-full"
            placeholder="e.g. 25.00"
          />
        </div>

        <!-- Stop price — shown for stop and stop-limit -->
        <div v-if="form.orderType === 'stop' || form.orderType === 'stop-limit'">
          <label for="op-stop-price" class="block text-xs font-medium text-text-secondary mb-1">Stop price (USD/MWh)</label>
          <input
            id="op-stop-price"
            v-model.number="form.stopPrice"
            type="number"
            min="0"
            step="0.01"
            required
            class="rex-input w-full"
            placeholder="e.g. 22.00"
          />
        </div>

        <!-- Asset -->
        <div>
          <label for="op-asset" class="block text-xs font-medium text-text-secondary mb-1">
            Asset
            <span class="text-text-muted font-normal">
              {{ form.side === 'buy' ? '(optional — leave blank for any)' : '(required for sell)' }}
            </span>
          </label>
          <select id="op-asset" v-model="form.contractAddress" class="rex-select w-full">
            <option v-if="form.side === 'buy'" value="">Any available asset</option>
            <option
              v-for="contract in availableContracts"
              :key="contract.address ?? contract.name"
              :value="contract.address ?? ''"
            >
              {{ contract.abbreviation }} — {{ contract.name }}
            </option>
          </select>
          <p v-if="form.side === 'sell' && heldAssets.length === 0" class="mt-1 text-2xs text-text-muted">
            No held assets found. Visit the dashboard first to load your portfolio.
          </p>
        </div>

        <!-- Amount -->
        <div>
          <label for="op-amount" class="block text-xs font-medium text-text-secondary mb-1">Amount (MWh)</label>
          <input
            id="op-amount"
            v-model.number="form.amount"
            type="number"
            min="1"
            step="1"
            required
            class="rex-input w-full"
            placeholder="e.g. 100"
          />
        </div>

        <div v-if="successMsg" role="status" aria-live="polite" class="rounded border border-success-subtle bg-success-subtle px-3 py-2 text-sm text-success">
          {{ successMsg }}
        </div>
        <div v-if="errorMsg" role="alert" aria-live="assertive" class="rounded border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
          {{ errorMsg }}
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {{ submitting ? 'Placing…' : 'Place order' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContractsStore } from '~/stores/contracts'

const emit = defineEmits<{ placed: [] }>()

const contractsStore = useContractsStore()

const heldAssets = computed(() => contractsStore.assets ?? [])

const availableContracts = computed(() => {
  if (form.side === 'sell') {
    return contractsStore.contractsRaw.filter(c =>
      c.address && heldAssets.value.some(a => a.address?.toLowerCase() === c.address?.toLowerCase()),
    )
  }
  return contractsStore.contractsRaw.filter(c => c.address)
})

const submitting = ref(false)
const successMsg = ref('')
const errorMsg   = ref('')

const form = reactive({
  side:            'buy' as 'buy' | 'sell',
  orderType:       'market' as 'market' | 'limit' | 'stop' | 'stop-limit',
  contractAddress: '',
  amount:          null as number | null,
  limitPrice:      null as number | null,
  stopPrice:       null as number | null,
})

watch(() => form.orderType, () => {
  form.limitPrice = null
  form.stopPrice  = null
})

watch(() => form.side, () => {
  form.contractAddress = ''
})

const selectedContract = computed(() =>
  form.contractAddress
    ? contractsStore.contractsRaw.find(c => c.address === form.contractAddress)
    : null,
)

async function submitOrder() {
  successMsg.value = ''
  errorMsg.value   = ''
  submitting.value = true

  try {
    await $fetch('/api/orders', {
      method: 'POST',
      body: {
        side:            form.side,
        orderType:       form.orderType,
        amount:          form.amount,
        contractAddress: form.contractAddress || undefined,
        contractName:    selectedContract.value?.name,
        abbreviation:    selectedContract.value?.abbreviation,
        limitPrice:      form.limitPrice ?? undefined,
        stopPrice:       form.stopPrice ?? undefined,
      },
    })
    successMsg.value    = 'Order placed and queued for REX staff review.'
    form.amount         = null
    form.limitPrice     = null
    form.stopPrice      = null
    emit('placed')
  } catch (e: unknown) {
    errorMsg.value = (e as { statusMessage?: string })?.statusMessage ?? 'Failed to place order'
  } finally {
    submitting.value = false
  }
}
</script>

