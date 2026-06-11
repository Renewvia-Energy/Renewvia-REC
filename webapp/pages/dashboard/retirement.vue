<template>
  <div class="p-6 space-y-6 max-w-7xl">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <h1 class="font-display text-2xl font-semibold text-text-primary">Retirement Center</h1>
      <button
        v-if="hasRetirements"
        class="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        @click="openCumulative"
      >
        Cumulative Certificate
      </button>
    </div>

    <!-- Summary stats -->
    <div v-if="hasRetirements" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div v-if="contractsStore.totalRetiredMwh > 0" class="card card-body">
        <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">MWh Retired</p>
        <p class="font-display text-2xl font-bold text-text-primary tabular-nums">
          {{ contractsStore.totalRetiredMwh.toLocaleString() }}
        </p>
      </div>
      <div v-if="contractsStore.totalRetiredTco2e > 0" class="card card-body">
        <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">tCO₂e Avoided (est.)</p>
        <p class="font-display text-2xl font-bold text-text-primary tabular-nums">
          {{ contractsStore.totalRetiredTco2e.toFixed(1) }}
        </p>
      </div>
      <div v-if="totalRetiredCc > 0" class="card card-body">
        <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">tCO₂e Retired (CC)</p>
        <p class="font-display text-2xl font-bold text-text-primary tabular-nums">
          {{ totalRetiredCc.toLocaleString() }}
        </p>
      </div>
      <div class="card card-body">
        <p class="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">Retirement Events</p>
        <p class="font-display text-2xl font-bold text-text-primary tabular-nums">
          {{ retirements.length }}
        </p>
      </div>
    </div>

    <!-- Two-column layout: form + history -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <BuyerRetireOrderForm />
      <BuyerRetirementHistory
        :retirements="retirements"
        :polygonscan-base="config.public.polygonscanBase"
        @certify="openSingle"
      />
    </div>

    <!-- Certificate modal -->
    <BuyerRetirementCertificateModal
      v-model="certOpen"
      :mode="certMode"
      :item="certItem ?? undefined"
      :rec-mwh="cumulativeRecMwh"
      :rec-tco2e="cumulativeRecTco2e"
      :cc-tco2e="cumulativeCcTco2e"
      :breakdown="cumulativeBreakdown"
    />
  </div>
</template>

<script setup lang="ts">
import type { ActivityItem } from '~/stores/contracts'
import type { BreakdownRow } from '~/components/buyer/RetirementCertificate.vue'
import { useContractsStore } from '~/stores/contracts'

definePageMeta({ middleware: 'buyer' })
useHead({ title: 'Retirement Center' })

const config         = useRuntimeConfig()
const contractsStore = useContractsStore()

// All confirmed on-chain retirements for this wallet
const retirements = computed(() =>
  contractsStore.activity
    .filter(a => a.rawAction === 'retire')
    .slice()
    .reverse(), // newest first
)

const hasRetirements = computed(() => retirements.value.length > 0)

// Carbon-credit retirements (superclass === 'CC') — amount is already tCO₂e
const totalRetiredCc = computed(() =>
  retirements.value
    .filter(item => {
      return contractsStore.contractsRaw.find(
        c => c.address && c.address.toLowerCase() === item.contractAddress?.toLowerCase(),
      )?.superclass === 'CC'
    })
    .reduce((sum, item) => sum + item.amount, 0),
)

// ── Cumulative certificate data ───────────────────────────────────────────────

const cumulativeBreakdown = computed<BreakdownRow[]>(() => {
  const map: Record<string, BreakdownRow> = {}
  for (const item of retirements.value) {
    const superclass = contractsStore.contractsRaw.find(
      c => c.address && c.address.toLowerCase() === item.contractAddress?.toLowerCase(),
    )?.superclass ?? 'REC'
    const key = item.abbreviation
    if (!map[key]) {
      map[key] = { abbreviation: item.abbreviation, name: item.name, amount: 0, superclass }
    }
    map[key].amount += item.amount
  }
  return Object.values(map).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
})

const cumulativeRecMwh = computed(() =>
  cumulativeBreakdown.value
    .filter(r => r.superclass === 'REC')
    .reduce((sum, r) => sum + r.amount, 0),
)

const cumulativeRecTco2e = computed(() =>
  cumulativeBreakdown.value
    .filter(r => r.superclass === 'REC')
    .reduce((sum, r) => sum + r.amount * contractsStore.co2eFactor(r.abbreviation), 0),
)

const cumulativeCcTco2e = computed(() =>
  cumulativeBreakdown.value
    .filter(r => r.superclass === 'CC')
    .reduce((sum, r) => sum + r.amount, 0),
)

// ── Modal state ───────────────────────────────────────────────────────────────

const certOpen = ref(false)
const certMode = ref<'single' | 'cumulative'>('cumulative')
const certItem = ref<ActivityItem | null>(null)

function openCumulative() {
  certMode.value = 'cumulative'
  certItem.value = null
  certOpen.value = true
}

function openSingle(item: ActivityItem) {
  certMode.value = 'single'
  certItem.value = item
  certOpen.value = true
}
</script>
