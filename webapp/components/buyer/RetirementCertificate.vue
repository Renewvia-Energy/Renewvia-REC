<template>
  <div class="retirement-cert bg-white text-gray-900" style="font-family: 'Barlow', sans-serif; --cert-brand: oklch(38% 0.09 195);">

    <!-- Header bar -->
    <div class="flex items-center justify-between pb-5 mb-6 border-b-2" style="border-color: var(--cert-brand);">
      <div class="flex items-center gap-3">
        <img src="/images/logo-titled.png" alt="REX" class="h-8 object-contain" />
      </div>
      <div class="text-right">
        <p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--cert-brand);">Retirement Certificate</p>
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
        <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Certified by retirement</p>
        <h2 class="text-2xl font-bold text-gray-900" style="font-family: 'Bricolage Grotesque', sans-serif;">
          {{ company?.name ?? 'Portfolio Holder' }}
        </h2>
      </div>
    </div>

    <!-- ── SINGLE MODE ── -->
    <template v-if="mode === 'single' && item">

      <!-- Hero stat -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div class="rounded-lg p-5" style="background-color: var(--cert-brand);">
          <p class="text-2xs font-semibold uppercase tracking-widest text-white/70 mb-1">
            {{ isCarbonCredit ? 'tCO₂e Retired' : 'MWh Retired' }}
          </p>
          <p class="font-bold text-white tabular-nums leading-none" style="font-size: 2.5rem; font-family: 'Bricolage Grotesque', sans-serif;">
            {{ item.amount.toLocaleString() }}
          </p>
          <p class="text-xs text-white/60 mt-1.5">{{ isCarbonCredit ? 'tonnes CO₂ equivalent' : 'megawatt-hours' }}</p>
        </div>
        <div v-if="!isCarbonCredit" class="rounded-lg p-5 border-2" style="border-color: var(--cert-brand);">
          <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Carbon reduction <span class="text-gray-400">(est.)</span></p>
          <p class="font-bold tabular-nums leading-none" style="font-size: 2.5rem; color: oklch(38% 0.09 195); font-family: 'Bricolage Grotesque', sans-serif;">
            {{ singleTco2e.toFixed(1) }}
          </p>
          <p class="text-xs text-gray-400 mt-1.5">tCO₂e avoided</p>
        </div>
      </div>

      <!-- Detail block -->
      <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-8 text-sm">
        <div class="grid grid-cols-2 gap-4 px-4 py-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Asset</span>
          <span class="font-semibold text-gray-900">{{ item.abbreviation }} — {{ item.name }}</span>
        </div>
        <div class="grid grid-cols-2 gap-4 px-4 py-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Retirement date</span>
          <span class="text-gray-900">{{ retirementDate }}</span>
        </div>
        <div v-if="item.hash" class="grid grid-cols-2 gap-4 px-4 py-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Transaction</span>
          <a
            :href="`${polygonscanBase}/tx/${item.hash}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs break-all"
            style="color: oklch(38% 0.09 195);"
          >
            {{ item.hash }}
          </a>
        </div>
        <div class="grid grid-cols-2 gap-4 px-4 py-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Retirement wallet</span>
          <span class="font-mono text-xs text-gray-600 break-all">{{ retirementWallet }}</span>
        </div>
      </div>

    </template>

    <!-- ── CUMULATIVE MODE ── -->
    <template v-else-if="mode === 'cumulative'">

      <!-- Hero stats -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div v-if="recMwh > 0" class="rounded-lg p-5" style="background-color: var(--cert-brand);">
          <p class="text-2xs font-semibold uppercase tracking-widest text-white/70 mb-1">Total MWh Retired</p>
          <p class="font-bold text-white tabular-nums leading-none" style="font-size: 2.5rem; font-family: 'Bricolage Grotesque', sans-serif;">
            {{ formatNumber(recMwh) }}
          </p>
          <p class="text-xs text-white/60 mt-1.5">megawatt-hours</p>
        </div>
        <div v-if="ccTco2e > 0" class="rounded-lg p-5" style="background-color: var(--cert-brand);">
          <p class="text-2xs font-semibold uppercase tracking-widest text-white/70 mb-1">Total tCO₂e Retired</p>
          <p class="font-bold text-white tabular-nums leading-none" style="font-size: 2.5rem; font-family: 'Bricolage Grotesque', sans-serif;">
            {{ formatNumber(ccTco2e) }}
          </p>
          <p class="text-xs text-white/60 mt-1.5">tonnes CO₂ equivalent</p>
        </div>
        <div v-if="recMwh > 0" class="rounded-lg p-5 border-2" style="border-color: var(--cert-brand);">
          <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Carbon reduction <span class="text-gray-400">(est.)</span></p>
          <p class="font-bold tabular-nums leading-none" style="font-size: 2.5rem; color: oklch(38% 0.09 195); font-family: 'Bricolage Grotesque', sans-serif;">
            {{ formatNumber(recTco2e) }}
          </p>
          <p class="text-xs text-gray-400 mt-1.5">tCO₂e avoided</p>
        </div>
      </div>

      <!-- Breakdown table -->
      <div v-if="breakdown.length > 0" class="mb-8">
        <p class="text-2xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Retirement breakdown</p>
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b-2" style="border-color: var(--cert-brand);">
              <th class="text-left py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Asset</th>
              <th class="text-right py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
              <th class="text-right py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in breakdown"
              :key="row.abbreviation"
              class="border-b border-gray-100"
            >
              <td class="py-2.5">
                <p class="font-semibold text-gray-900">{{ row.abbreviation }}</p>
                <p class="text-2xs text-gray-400 truncate max-w-[200px]">{{ row.name }}</p>
              </td>
              <td class="py-2.5 text-right font-mono font-semibold text-gray-900 tabular-nums">
                {{ row.amount.toLocaleString() }}
              </td>
              <td class="py-2.5 text-right text-gray-500 tabular-nums">
                {{ row.superclass === 'CC' ? 'tCO₂e' : 'MWh' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Retirement wallet -->
      <div class="rounded-lg border border-gray-200 px-4 py-3 mb-8 text-sm">
        <span class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-1">Retirement wallet</span>
        <span class="font-mono text-xs text-gray-600 break-all">{{ retirementWallet }}</span>
      </div>

    </template>

    <!-- Standards note -->
    <div class="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-8">
      <p class="text-2xs text-gray-500 leading-relaxed">
        This certificate documents retirement of tokenized energy certificates on the Polygon blockchain.
        Carbon estimates use regional grid emission factors (AVERT / Ember).
        This document supports GHG Protocol Scope 2 market-based accounting.
        <span v-if="mode === 'single' && !isCarbonCredit"> Estimate is approximate — final values require AVERT / Ember methodology.</span>
      </p>
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
import type { ActivityItem, CompanyRecord } from '~/stores/contracts'
import { useContractsStore } from '~/stores/contracts'

export interface BreakdownRow {
  abbreviation: string
  name: string
  amount: number
  superclass: string
}

const props = defineProps<{
  company?: CompanyRecord
  wallet: string
  retirementWallet: string
  polygonscanBase: string
  mode: 'single' | 'cumulative'
  // single mode
  item?: ActivityItem
  isCarbonCredit?: boolean
  // cumulative mode
  recMwh?: number
  recTco2e?: number
  ccTco2e?: number
  breakdown?: BreakdownRow[]
}>()

const contractsStore = useContractsStore()

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

const retirementDate = computed(() => {
  if (!props.item) return ''
  return new Date(parseInt(props.item.timeStamp) * 1000)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})

const singleTco2e = computed(() => {
  if (!props.item) return 0
  return props.item.amount * contractsStore.co2eFactor(props.item.abbreviation)
})

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(1)
}
</script>
