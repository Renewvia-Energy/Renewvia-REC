<template>
  <div class="impact-cert bg-white text-gray-900" style="font-family: 'Barlow', sans-serif; --cert-brand: oklch(38% 0.09 195);">

    <!-- Header bar -->
    <div class="flex items-center justify-between pb-5 mb-6 border-b-2" style="border-color: var(--cert-brand);">
      <div class="flex items-center gap-3">
        <img src="/images/logo-titled.png" alt="REX" class="h-8 object-contain" />
      </div>
      <div class="text-right">
        <p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--cert-brand);">Impact Certificate</p>
        <p class="text-xs text-gray-500 mt-0.5">{{ generatedDate }}</p>
      </div>
    </div>

    <!-- Company section -->
    <div class="flex items-center gap-4 mb-8">
      <img
        v-if="company?.logo"
        :src="company.logo"
        :alt="company.name"
        class="h-14 w-14 rounded object-contain border border-gray-200 p-1 shrink-0"
      />
      <div
        v-else
        class="h-14 w-14 rounded flex items-center justify-center shrink-0 text-white font-bold text-lg"
        style="background-color: var(--cert-brand);"
      >
        {{ initials }}
      </div>
      <div>
        <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Certified holder</p>
        <h2 class="text-2xl font-bold text-gray-900" style="font-family: 'Bricolage Grotesque', sans-serif;">
          {{ company?.name ?? 'Portfolio Holder' }}
        </h2>
      </div>
    </div>

    <!-- Hero stats -->
    <div class="grid grid-cols-2 gap-4 mb-8">
      <div class="rounded-lg p-5" style="background-color: var(--cert-brand);">
        <p class="text-2xs font-semibold uppercase tracking-widest text-white/70 mb-1">MWh held</p>
        <p class="font-bold text-white tabular-nums leading-none" style="font-size: 2.5rem; font-family: 'Bricolage Grotesque', sans-serif;">
          {{ formatNumber(totalMwh) }}
        </p>
        <p class="text-xs text-white/60 mt-1.5">megawatt-hours</p>
      </div>
      <div class="rounded-lg p-5 border-2" style="border-color: var(--cert-brand);">
        <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Carbon reduction
          <span class="text-gray-400">(est.)</span>
        </p>
        <p class="font-bold tabular-nums leading-none" style="font-size: 2.5rem; color: oklch(38% 0.09 195); font-family: 'Bricolage Grotesque', sans-serif;">
          {{ formatNumber(totalTco2e) }}
        </p>
        <p class="text-xs text-gray-400 mt-1.5">tCO₂e avoided</p>
      </div>
    </div>

    <!-- Retired RECs (if any) -->
    <div v-if="totalRetiredMwh > 0" class="flex gap-6 mb-8 px-5 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
      <div>
        <span class="text-gray-400 text-xs uppercase tracking-wide font-semibold">Retired</span>
        <p class="font-semibold text-gray-800 tabular-nums">{{ formatNumber(totalRetiredMwh) }} MWh</p>
      </div>
      <div class="w-px bg-gray-200 self-stretch" />
      <div>
        <span class="text-gray-400 text-xs uppercase tracking-wide font-semibold">Retired tCO₂e</span>
        <p class="font-semibold text-gray-800 tabular-nums">{{ formatNumber(totalRetiredTco2e) }} tCO₂e</p>
      </div>
    </div>

    <!-- Holdings table -->
    <div class="mb-8">
      <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Holdings breakdown</p>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b-2" style="border-color: var(--cert-brand);">
            <th class="text-left py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Asset</th>
            <th class="text-right py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Balance (MWh)</th>
            <th class="text-right py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Est. tCO₂e</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="asset in assets"
            :key="asset.address ?? asset.abbreviation"
            class="border-b border-gray-100"
          >
            <td class="py-2.5">
              <p class="font-semibold text-gray-900">{{ asset.abbreviation }}</p>
              <p class="text-2xs text-gray-400 truncate max-w-[200px]">{{ asset.name }}</p>
            </td>
            <td class="py-2.5 text-right font-mono font-semibold text-gray-900 tabular-nums">
              {{ asset.amount.toLocaleString() }}
            </td>
            <td class="py-2.5 text-right font-mono text-gray-500 tabular-nums">
              {{ (asset.amount * co2eFactorFor(asset.abbreviation)).toFixed(1) }}
            </td>
          </tr>
          <tr v-if="assets.length === 0">
            <td colspan="4" class="py-6 text-center text-gray-400 text-sm">No holdings on record</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="pt-5 border-t border-gray-200 flex items-end justify-between gap-4">
      <div>
        <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-1">On-chain verification</p>
        <a
          v-if="wallet && polygonscanBase"
          :href="`${polygonscanBase}/address/${wallet}`"
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono text-xs text-gray-500"
        >
          {{ wallet }}
        </a>
        <p class="text-2xs text-gray-400 mt-1">Polygon blockchain · Publicly verifiable</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs font-semibold" style="color: var(--cert-brand);">REX</p>
        <p class="text-2xs text-gray-400">Renewable Energy Certificates</p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { CompanyRecord, AssetHolding } from '~/stores/contracts'

const CO2E_FACTORS: Record<string, number> = {
  'RREC-AL':  0.37,
  'RREC-GA':  0.37,
  'RREC-NC':  0.37,
  'RREC-VA':  0.40,
  'SC-REC':   0.37,
  'RREC-ACM': 0.57,
  'RREC-ACI': 0.50,
  'RREC-AKE': 0.10,
  'RREC-ACD': 0.05,
  'RREC-ASN': 0.60,
  'RREC-AZA': 0.90,
  'RREC-ANG': 0.43,
}

const props = defineProps<{
  company?: CompanyRecord
  wallet: string
  assets: AssetHolding[]
  totalMwh: number
  totalTco2e: number
  totalRetiredMwh: number
  totalRetiredTco2e: number
  polygonscanBase: string
}>()

const initials = computed(() => {
  if (!props.company?.name) return '?'
  return props.company.name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
})

const generatedDate = computed(() =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
)

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(1)
}

function co2eFactorFor(abbreviation: string): number {
  return CO2E_FACTORS[abbreviation] ?? 0.50
}
</script>
