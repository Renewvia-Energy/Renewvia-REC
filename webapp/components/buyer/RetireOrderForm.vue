<template>
  <div class="card">
    <div class="card-header">
      <h2 class="font-display text-lg font-semibold text-text-primary">Retire RECs</h2>
    </div>
    <div class="card-body space-y-4">
      <p class="text-sm text-text-muted">
        Retirement transfers RECs to the permanent retirement wallet, removing them from circulation.
        REX staff will execute the on-chain transfer after reviewing your request.
      </p>

      <form class="space-y-4" @submit.prevent="submitOrder">
        <!-- Asset -->
        <div>
          <label for="rf-asset" class="block text-xs font-medium text-text-secondary mb-1">Asset <span class="text-danger">*</span></label>
          <select id="rf-asset" v-model="form.contractAddress" class="rex-select w-full" required>
            <option value="" disabled>Select an asset to retire</option>
            <option
              v-for="asset in heldAssets"
              :key="asset.address ?? asset.name"
              :value="asset.address ?? ''"
            >
              {{ asset.abbreviation }} — {{ asset.name }} ({{ asset.amount.toLocaleString() }} MWh held)
            </option>
          </select>
          <p v-if="heldAssets.length === 0" class="mt-1 text-2xs text-text-muted">
            No held assets found. Visit the dashboard first to load your portfolio.
          </p>
        </div>

        <!-- Amount -->
        <div>
          <label for="rf-amount" class="block text-xs font-medium text-text-secondary mb-1">Amount (MWh) <span class="text-danger">*</span></label>
          <input
            id="rf-amount"
            v-model.number="form.amount"
            type="number"
            min="1"
            :max="selectedAsset?.amount ?? undefined"
            step="1"
            required
            class="rex-input w-full"
            placeholder="e.g. 100"
          />
          <p v-if="selectedAsset" class="mt-1 text-2xs text-text-muted">
            {{ selectedAsset.amount.toLocaleString() }} MWh available
          </p>
        </div>

        <div v-if="successMsg" role="status" aria-live="polite" class="rounded border border-success-subtle bg-success-subtle px-3 py-2 text-sm text-success">
          {{ successMsg }}
        </div>
        <div v-if="errorMsg" role="alert" aria-live="assertive" class="rounded border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
          {{ errorMsg }}
        </div>

        <button
          type="submit"
          :disabled="submitting || heldAssets.length === 0"
          class="w-full rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {{ submitting ? 'Submitting…' : 'Submit Retirement Request' }}
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

const form = reactive({
  contractAddress: '',
  amount:          null as number | null,
})

const selectedAsset = computed(() =>
  form.contractAddress
    ? heldAssets.value.find(a => a.address === form.contractAddress)
    : null,
)

const selectedContract = computed(() =>
  form.contractAddress
    ? contractsStore.contractsRaw.find(c => c.address === form.contractAddress)
    : null,
)

watch(() => form.contractAddress, () => {
  form.amount = null
})

const submitting = ref(false)
const successMsg = ref('')
const errorMsg   = ref('')

async function submitOrder() {
  successMsg.value = ''
  errorMsg.value   = ''
  submitting.value = true

  try {
    await $fetch('/api/orders', {
      method: 'POST',
      body: {
        side:            'retire',
        amount:          form.amount,
        contractAddress: form.contractAddress,
        contractName:    selectedContract.value?.name,
        abbreviation:    selectedContract.value?.abbreviation,
      },
    })
    successMsg.value     = 'Retirement request submitted. REX staff will execute the on-chain transfer.'
    form.contractAddress = ''
    form.amount          = null
    emit('placed')
  } catch (e: unknown) {
    errorMsg.value = (e as { statusMessage?: string })?.statusMessage ?? 'Failed to submit request'
  } finally {
    submitting.value = false
  }
}
</script>
