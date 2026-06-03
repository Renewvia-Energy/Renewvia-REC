<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      data-rex-modal
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="relative w-full max-w-2xl my-8">

        <!-- Modal chrome (hidden when printing) -->
        <div data-rex-modal-chrome class="flex items-center justify-between mb-3 px-1">
          <p class="text-sm font-semibold text-white">
            {{ mode === 'single' ? 'Retirement Certificate' : 'Cumulative Retirement Certificate' }}
          </p>
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              @click="doPrint"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print / Save PDF
            </button>
            <button
              class="flex items-center justify-center w-8 h-8 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
              @click="$emit('update:modelValue', false)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Certificate card -->
        <div class="rounded-xl shadow-2xl overflow-hidden p-8" style="background: white;">
          <BuyerRetirementCertificate
            :company="company"
            :wallet="wallet"
            :retirement-wallet="config.public.retirementWallet"
            :polygonscan-base="config.public.polygonscanBase"
            :mode="mode"
            :item="item"
            :is-carbon-credit="isCarbonCredit"
            :rec-mwh="recMwh"
            :rec-tco2e="recTco2e"
            :cc-tco2e="ccTco2e"
            :breakdown="breakdown"
          />
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ActivityItem } from '~/stores/contracts'
import type { BreakdownRow } from '~/components/buyer/RetirementCertificate.vue'
import { useAuthStore } from '~/stores/auth'
import { useContractsStore } from '~/stores/contracts'

const props = defineProps<{
  modelValue: boolean
  mode: 'single' | 'cumulative'
  // single mode — the blockchain ActivityItem for this retirement
  item?: ActivityItem
  // cumulative mode — pre-computed totals and breakdown
  recMwh?: number
  recTco2e?: number
  ccTco2e?: number
  breakdown?: BreakdownRow[]
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()

const config         = useRuntimeConfig()
const authStore      = useAuthStore()
const contractsStore = useContractsStore()
const { sessionUser } = storeToRefs(authStore)

const company = computed(() =>
  sessionUser.value?.companyWallet
    ? contractsStore.companyForWallet(sessionUser.value.companyWallet)
    : undefined,
)

const wallet = computed(() => sessionUser.value?.companyWallet ?? '')

// Determine if a single-mode item is a carbon credit (superclass === 'CC')
const isCarbonCredit = computed(() => {
  if (!props.item) return false
  return contractsStore.contractsRaw.find(
    c => c.address && c.address.toLowerCase() === props.item!.contractAddress?.toLowerCase(),
  )?.superclass === 'CC'
})

function doPrint() {
  const style = document.createElement('style')
  style.id = 'rex-print-style'
  style.textContent = `
    @media print {
      body > *:not([data-rex-modal]) { display: none !important; }
      [data-rex-modal] {
        position: fixed; inset: 0;
        background: white !important;
        display: flex !important;
        align-items: flex-start;
        justify-content: center;
        padding: 1.5rem;
        overflow: visible;
      }
      [data-rex-modal-chrome] { display: none !important; }
      [data-rex-modal] > div { margin: 0; width: 100%; max-width: 680px; box-shadow: none !important; }
    }
  `
  document.head.appendChild(style)
  window.addEventListener('afterprint', () => {
    document.getElementById('rex-print-style')?.remove()
  }, { once: true })
  window.print()
}
</script>
